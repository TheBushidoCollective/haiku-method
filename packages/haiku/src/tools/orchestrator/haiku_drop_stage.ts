// tools/orchestrator/haiku_drop_stage.ts — Drop an OPTIONAL stage from
// an intent's plan when the cursor is actively on it.
//
// FIRES WHEN: the cursor's elaborate-loop offers a keep-or-drop decision
// (the `optional_offer` on the first arrival at an optional stage). The
// agent — or the user, in interactive/discrete mode — decides the stage
// doesn't apply to this intent and calls this tool. Dropping removes the
// stage from `intent.stages` (the canonical materialized plan); the next
// `haiku_run_next` re-derives the active stage and advances. Cross-stage
// references to the dropped stage (downstream inputs / review-agents-
// include) auto-ignore — a dropped stage produces nothing, so its declared
// inputs resolve to absent files and the coverage gate skips it.
//
// Guards (stable named codes the agent/tests match on):
//   - drop_stage_not_active      — `stage` is not the intent's active stage.
//                                  The decision is made at ARRIVAL; you can't
//                                  drop a future (or past) stage from afar.
//   - drop_stage_not_optional    — the stage isn't marked `optional: true`.
//   - drop_stage_already_started — elaboration or units exist; it's started,
//                                  so this is a reset, not a drop.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { deleteStageBranch, ensureOnStageBranch } from "../../git-worktree.js"
import {
	resolveIntentStages,
	resolveStageOptional,
} from "../../orchestrator/studio.js"
import {
	findCurrentStage,
	listUnitPaths,
} from "../../orchestrator/workflow/cursor.js"
import {
	HAIKU_DROP_STAGE_INPUT_SCHEMA,
	type HaikuDropStageInput,
	validateHaikuDropStageInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import {
	findHaikuRoot,
	gitCommitState,
	isGitRepo,
	parseFrontmatter,
	setFrontmatterField,
} from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { withAnnouncement } from "./_announce.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_drop_stage",
	description:
		"Drop an OPTIONAL stage from an intent's plan. Use when the elaborate-loop offered a keep-or-drop decision for an optional stage (e.g. design / product / operations / release) and this intent doesn't need it. Removes the stage from the intent's plan; the next haiku_run_next advances to the following stage. Only the ACTIVE, not-yet-started stage can be dropped — refuses a non-active stage (drop_stage_not_active), a non-optional stage (drop_stage_not_optional), or a started stage (drop_stage_already_started).",
	inputSchema: jsonSchemaOf(HAIKU_DROP_STAGE_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuDropStageInputSchema,
			"haiku_drop_stage",
		)
		if (inputErr) return inputErr
		const { intent: slug, stage } = args as HaikuDropStageInput

		const root = findHaikuRoot()
		const iDir = join(root, "intents", slug)
		const intentFile = join(iDir, "intent.md")
		if (!existsSync(intentFile)) {
			return text(
				JSON.stringify({
					error: "not_found",
					message: `Intent '${slug}' not found`,
				}),
			)
		}

		const intentFm = parseFrontmatter(readFileSync(intentFile, "utf8")).data
		const studio = (intentFm.studio as string) || ""
		if (!studio) {
			return text(
				JSON.stringify({
					error: "studio_not_selected",
					message: `Intent '${slug}' has no studio selected.`,
				}),
			)
		}

		// Guard 1 — the stage must be the intent's ACTIVE stage. Drop is an
		// at-arrival decision; the cursor must currently be on it.
		const activeStage = findCurrentStage(slug, studio, iDir) ?? ""
		if (stage !== activeStage) {
			return text(
				JSON.stringify({
					error: "drop_stage_not_active",
					message: `Stage '${stage}' is not the active stage of intent '${slug}' (active: '${activeStage || "(none)"}'). An optional stage can only be dropped when the cursor is on it — the decision is made at arrival, not for a future or past stage.`,
				}),
			)
		}

		// Guard 2 — the stage must be declared optional.
		if (!resolveStageOptional(studio, stage)) {
			return text(
				JSON.stringify({
					error: "drop_stage_not_optional",
					message: `Stage '${stage}' is not optional (no \`optional: true\` in its STAGE.md). Mandatory stages cannot be dropped.`,
				}),
			)
		}

		// Guard 3 — the stage must not have started (no elaboration, no units).
		// A started stage is a reset, not a drop.
		const stageDir = join(iDir, "stages", stage)
		const started =
			existsSync(join(stageDir, "elaboration.md")) ||
			listUnitPaths(stageDir).length > 0
		if (started) {
			return text(
				JSON.stringify({
					error: "drop_stage_already_started",
					message: `Stage '${stage}' has already started (elaboration recorded or units drafted). Dropping only applies before any work — use a stage reset if you need to discard started work.`,
				}),
			)
		}

		// Drop: remove the stage from the canonical plan. resolveIntentStages
		// materializes the current plan (handles a legacy intent whose `stages`
		// wasn't materialized yet); filtering out `stage` both materializes AND
		// drops in one write.
		const planStages = resolveIntentStages(intentFm, studio)
		const droppedIdx = planStages.indexOf(stage)
		const nextStage = planStages[droppedIdx + 1]
		const nextStages = planStages.filter((s) => s !== stage)

		// Land the drop on INTENT MAIN — the fork source for every future
		// stage branch (`ensureStageBranch` does `git branch <stage> <main>`).
		// `intent.stages` is engine-owned FSM state; the keep-or-drop offer
		// parked the checkout on the optional stage's own branch (the cursor's
		// post-action branch switch), so a naive write would commit the drop
		// there and strand it. The per-tick downstream sync only flows
		// main → stage, and a dropped stage never completes (so it never
		// merges up), so intent main would never see the drop: the next stage
		// forks from a main that still lists the dropped stage, the cursor
		// flip-flops dropped ⇆ next every tick, and the deadlock detector
		// halts the loop — the "haiku next hangs after a drop" report.
		//
		// Guard 3 already proved the stage never started, so its branch holds
		// no work to preserve. Switch back to intent main, write the drop
		// there, then reap the abandoned optional-stage branch so it can't
		// reassert the stale plan through a later sync. No-op in fs mode (no
		// branches) — the single intent.md is authoritative as-is.
		if (isGitRepo()) {
			const mainGuard = ensureOnStageBranch(slug, undefined)
			if (!mainGuard.ok) {
				return text(
					JSON.stringify({
						error: "drop_stage_branch_switch_failed",
						message: `Could not switch to intent main to land the drop of '${stage}': ${mainGuard.message}. Resolve the working-tree state (commit or stash any stray changes) and retry.`,
					}),
				)
			}
		}
		setFrontmatterField(intentFile, "stages", nextStages)
		gitCommitState(`haiku: drop optional stage ${stage} from ${slug}`)
		// Reap the optional stage's now-orphaned branch (we're off it, on
		// intent main). Best-effort — deleteStageBranch never throws.
		if (isGitRepo()) deleteStageBranch(slug, stage)
		emitTelemetry("haiku.stage.dropped", { intent: slug, stage, studio })

		return text(
			JSON.stringify({
				action: "stage_dropped",
				intent: slug,
				stage,
				stages: nextStages,
				message: withAnnouncement(
					`Dropped the optional **${stage}** stage from intent "${slug}".`,
					`Call haiku_run_next { intent: "${slug}" } to advance${
						nextStage ? ` to the next stage (\`${nextStage}\`)` : ""
					}.`,
				),
			}),
		)
	},
})
