// tools/orchestrator/haiku_unit_reset.ts — Reset ONE unit back to pending
// without touching its siblings or the stage branch.
//
// The recovery primitive the bolt-cap escalation always promised but the
// toolset never provided (bug report Issue 1). When a unit hits the bolt cap
// or its SPEC premise was wrong from the start, there was no supported way to
// "reset + rebuild" just that unit: haiku_unit_delete / haiku_unit_write are
// pending-only; haiku_stage_reset wipes the whole stage (every sibling unit,
// the outputs, the stage branch). This fills the gap.
//
// Scope (destructive, confirmed via SPA picker):
//   - Clear the unit's FSM frontmatter (iterations/reviews/approvals/
//     started_at + the legacy hat/bolt/status + the model escalation) so it
//     derives back to `pending` and can be re-authored (haiku_unit_write) or
//     re-run from scratch.
//   - Discard the unit's worktree + branch (haiku/<slug>/<unit>, local AND
//     the pushed remote), rolling its in-progress code back to the stage
//     baseline.
//
// What stays:
//   - The unit SPEC file itself (now pending — rewrite it if the premise was
//     wrong, or re-run it as-is).
//   - Every SIBLING unit (each on its own branch) and the stage branch.
//   - All other stages.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import matter from "gray-matter"
import { cleanupUnitWorktree } from "../../git-worktree.js"
import { runPicker } from "../../server/picker.js"
import {
	HAIKU_UNIT_RESET_INPUT_SCHEMA,
	type HaikuUnitResetInput,
	validateHaikuUnitResetInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import {
	deriveUnitStatus,
	gitCommitState,
	unitPath,
} from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

// Fields cleared to return the unit to `pending`. The first four are the
// FSM-driven set deriveUnitStatus reads; the rest are legacy/escalation
// bookkeeping that would otherwise leave stale state on the re-run.
const FIELDS_TO_CLEAR = [
	"iterations",
	"reviews",
	"approvals",
	"started_at",
	"hat",
	"hat_started_at",
	"bolt",
	"status",
] as const

export default defineTool({
	name: "haiku_unit_reset",
	description:
		"Reset ONE unit back to pending: clear its iterations/reviews/approvals so it can be re-authored or re-run, and discard its worktree + branch (rolling its in-progress code back to the stage baseline). Sibling units and the stage branch are untouched. Use when a unit hits the bolt cap or its spec premise was wrong from the start — the recovery path the escalation message points to. Requires user confirmation via the SPA picker.",
	inputSchema: jsonSchemaOf(HAIKU_UNIT_RESET_INPUT_SCHEMA),
	async handle(args, signal) {
		const inputErr = validateToolInput(
			args,
			validateHaikuUnitResetInputSchema,
			"haiku_unit_reset",
		)
		if (inputErr) return inputErr
		const { intent: slug, stage, unit } = args as HaikuUnitResetInput

		const path = unitPath(slug, stage, unit)
		if (!existsSync(path)) {
			return {
				content: [
					{
						type: "text" as const,
						text: `No unit '${unit}' in stage '${stage}' of intent '${slug}'.`,
					},
				],
				isError: true,
			}
		}

		const raw = readFileSync(path, "utf8")
		const { data, content } = matter(raw)
		const status = deriveUnitStatus(data as Record<string, unknown>)
		if (status === "pending") {
			return text(
				JSON.stringify({
					action: "noop",
					slug,
					stage,
					unit,
					message: `Unit '${unit}' is already pending — nothing to reset. Edit it with haiku_unit_write or let the engine run it.`,
				}),
			)
		}
		// Completed = work done. A completed unit's terminal hat advanced and its
		// code already merged into the stage branch; resetting it would clear the
		// engine's bookkeeping but could NOT un-merge the code — it only desyncs
		// state from the on-disk reality. Reset is a recovery primitive for
		// WEDGED IN-FLIGHT units (bolt cap, wrong premise mid-run), never a way
		// to undo finished, integrated work. To redo a completed unit, drive the
		// stage's fix-loop (file feedback) or revisit the stage — not reset.
		if (status === "completed") {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							error: "unit_completed_not_resettable",
							slug,
							stage,
							unit,
							message: `Unit '${unit}' is completed — its work is already merged into the stage branch. Reset cannot un-merge it and would only desync engine state from the code on disk. Reset is for wedged in-flight units only. To change completed work, file feedback against the stage (fix-loop) or revisit the stage.`,
						}),
					},
				],
				isError: true,
			}
		}

		const result = await runPicker({
			intentSlug: slug,
			kind: "confirm",
			title: `Reset unit "${unit}" (currently ${status}) on "${slug}"?`,
			prompt:
				`This will return unit '${unit}' in stage '${stage}' to **pending**:\n\n` +
				`- Clear its iterations / reviews / approvals (and the model escalation)\n` +
				`- Discard its worktree + branch \`haiku/${slug}/${unit}\` (local + remote) — its in-progress code rolls back to the stage baseline\n\n` +
				`The unit's SPEC file stays (rewrite it with haiku_unit_write if the premise was wrong, or re-run as-is). ` +
				`Sibling units and the stage branch are NOT touched. This cannot be undone.`,
			options: [
				{
					id: "reset",
					label: `Yes, reset ${unit}`,
					description: "Return the unit to pending and discard its worktree",
				},
				{
					id: "cancel",
					label: "Cancel",
					description: "Keep the unit as-is",
				},
			],
			signal,
		})
		if (
			result.timedOut ||
			!result.selection ||
			result.selection.id !== "reset"
		) {
			return text(
				JSON.stringify({
					action: "cancelled",
					message: `Reset of unit '${unit}' cancelled — no state mutated.`,
				}),
			)
		}

		// Clone before mutating: gray-matter caches parses by content string,
		// so mutating `data` in place would poison that cache for any later
		// read of the same content. Operate on a copy.
		const fm = structuredClone(data) as Record<string, unknown>
		// Undo the model escalation: restore the authored model from
		// model_original (if a reject bumped it) so a re-run starts at the
		// originally-chosen tier rather than the escalated one.
		if (typeof fm.model_original === "string" && fm.model_original.length > 0) {
			fm.model = fm.model_original
		}
		delete fm.model_original
		for (const f of FIELDS_TO_CLEAR) delete fm[f]
		// Delete (not set-undefined): the js-yaml dumper throws on undefined.
		writeFileSync(path, matter.stringify(content, fm))

		const reap = cleanupUnitWorktree(slug, unit)

		gitCommitState(`haiku: reset unit ${unit} on ${slug} (was ${status})`)

		return text(
			JSON.stringify(
				{
					action: "unit_reset",
					slug,
					stage,
					unit,
					previous_status: status,
					worktree: reap.message,
					message: `Unit '${unit}' reset to pending. Rewrite its spec with haiku_unit_write if its premise was wrong, then call haiku_run_next to re-run it. Siblings and the stage branch were untouched.`,
				},
				null,
				2,
			),
		)
	},
})
