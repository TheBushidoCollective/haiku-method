// tools/orchestrator/haiku_stage_reset.ts — Reset ONE stage of an
// intent without touching the others. Use after fixing the stage's
// hat instructions / studio config when the user wants the agent to
// re-run that stage cleanly.
//
// Scope (destructive, confirmed via SPA picker):
//   - Delete `stages/<stage>/units/*.md`
//   - Delete `stages/<stage>/outputs/`, `artifacts/`, `decisions.jsonl`
//   - Delete `stages/<stage>/elaboration.md`
//   - Delete `stages/<stage>/feedback/*.md`
//   - Delete `stages/<stage>/discovery/` contents EXCEPT the studio's
//     template files (templates are kept; outputs are wiped)
//   - Delete the stage's git branch (`haiku/<slug>/<stage>`); the
//     next haiku_run_next will fork it from intent main as needed
//
// What stays:
//   - intent.md (the whole intent's identity, including any approval
//     stamps that belong to OTHER stages)
//   - intent main's commits (the stage's prior merge into main stays
//     in history; new work supersedes via the normal merge path)
//   - Other stages' state — they're untouched

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import {
	branchExists,
	deleteStageBranch,
	getMainlineBranch,
} from "../../git-worktree.js"
import { runPicker } from "../../server/picker.js"
import {
	HAIKU_STAGE_RESET_INPUT_SCHEMA,
	type HaikuStageResetInput,
	validateHaikuStageResetInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { findHaikuRoot, gitCommitState, isGitRepo } from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_stage_reset",
	description:
		"Reset ONE stage of an intent: wipe its units, outputs, artifacts, elaboration, feedback, and stage branch. The intent's other stages are untouched. Use after fixing the stage's hat instructions or studio config when the user wants the agent to re-run that stage cleanly. Requires user confirmation via the SPA picker.",
	inputSchema: jsonSchemaOf(HAIKU_STAGE_RESET_INPUT_SCHEMA),
	async handle(args, signal) {
		const inputErr = validateToolInput(
			args,
			validateHaikuStageResetInputSchema,
			"haiku_stage_reset",
		)
		if (inputErr) return inputErr
		const { intent: slug, stage } = args as HaikuStageResetInput

		const root = findHaikuRoot()
		const iDir = join(root, "intents", slug)
		const intentFile = join(iDir, "intent.md")
		if (!existsSync(intentFile)) {
			return {
				content: [
					{ type: "text" as const, text: `Intent '${slug}' not found.` },
				],
				isError: true,
			}
		}

		const stageDir = join(iDir, "stages", stage)
		if (!existsSync(stageDir)) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Stage '${stage}' not found on intent '${slug}' (no \`stages/${stage}/\` directory).`,
					},
				],
				isError: true,
			}
		}

		// Build the list of paths about to be deleted so the picker
		// shows the user exactly what they're authorizing.
		const candidates: string[] = []
		for (const rel of [
			"units",
			"outputs",
			"artifacts",
			"feedback",
			"elaboration.md",
			"decisions.jsonl",
		]) {
			const p = join(stageDir, rel)
			if (existsSync(p)) candidates.push(rel)
		}
		// Discovery dir is partially preserved: studio templates stay,
		// agent-produced outputs are wiped. Surface this nuance to the
		// user in the confirmation.
		const discoveryDir = join(stageDir, "discovery")
		const hasDiscoveryOutputs = (() => {
			if (!existsSync(discoveryDir)) return false
			try {
				return readdirSync(discoveryDir).some((f) => {
					const full = join(discoveryDir, f)
					try {
						return statSync(full).isFile() && f.endsWith(".md")
					} catch {
						return false
					}
				})
			} catch {
				return false
			}
		})()
		if (hasDiscoveryOutputs)
			candidates.push("discovery (outputs only, templates preserved)")

		const stageBranch = `haiku/${slug}/${stage}`
		const willDeleteBranch = isGitRepo() && branchExists(stageBranch)
		if (willDeleteBranch) candidates.push(`git branch \`${stageBranch}\``)

		if (candidates.length === 0) {
			return text(
				JSON.stringify({
					action: "noop",
					message: `Stage '${stage}' has no resettable state — already clean.`,
				}),
			)
		}

		const result = await runPicker({
			intentSlug: slug,
			kind: "confirm",
			title: `Reset stage "${stage}" on intent "${slug}"?`,
			prompt:
				`This will DELETE the following from stage '${stage}':\n\n- ${candidates.join("\n- ")}\n\n` +
				`Other stages of '${slug}' will NOT be touched. Intent main's git history (including any prior merge of this stage) stays put. ` +
				`The next \`haiku_run_next\` will re-enter '${stage}' at its elaborate phase. This cannot be undone.`,
			options: [
				{
					id: "reset",
					label: `Yes, reset stage ${stage}`,
					description: "Wipe the stage and let the engine re-run it",
				},
				{
					id: "cancel",
					label: "Cancel",
					description: "Keep the stage as-is",
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
					message: `Reset of stage '${stage}' cancelled.`,
				}),
			)
		}

		// Move HEAD off the stage branch if currently on it — git
		// refuses to delete the branch the worktree is checked out on.
		// Mirrors the haiku_intent_reset checkout dance, narrower scope.
		if (isGitRepo()) {
			try {
				let currentBranch = ""
				try {
					currentBranch = execFileSync(
						"git",
						["rev-parse", "--abbrev-ref", "HEAD"],
						{ encoding: "utf8", stdio: "pipe" },
					).trim()
				} catch {
					/* detached HEAD — fine */
				}
				if (currentBranch === stageBranch) {
					const intentMain = `haiku/${slug}/main`
					const mainlineBranch = getMainlineBranch()
					const target = branchExists(intentMain) ? intentMain : mainlineBranch
					try {
						execFileSync("git", ["checkout", target], {
							encoding: "utf8",
							stdio: "pipe",
						})
					} catch {
						// Detached HEAD fallback.
						execFileSync("git", ["checkout", `${target}^0`], {
							encoding: "utf8",
							stdio: "pipe",
						})
					}
				}
			} catch (err) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Could not move HEAD off '${stageBranch}' for the delete. ${err instanceof Error ? err.message : String(err)}`,
						},
					],
					isError: true,
				}
			}
		}

		// Delete the stage directory contents (preserving discovery
		// templates — anything in discovery/ that came from the studio
		// vs. agent output). Templates land here via the studio's
		// `discovery/` template files; agent outputs land here as .md
		// files at the same path. We can't distinguish them after the
		// fact reliably, so the conservative rule is: wipe the .md
		// FILES in discovery/ (the outputs) but leave any subdirectories
		// alone (rarely used; preserves any structured templates).
		for (const rel of [
			"units",
			"outputs",
			"artifacts",
			"feedback",
			"elaboration.md",
			"decisions.jsonl",
		]) {
			const p = join(stageDir, rel)
			if (existsSync(p)) {
				rmSync(p, { recursive: true, force: true })
			}
		}
		if (hasDiscoveryOutputs) {
			try {
				for (const f of readdirSync(discoveryDir)) {
					if (!f.endsWith(".md")) continue
					const full = join(discoveryDir, f)
					try {
						if (statSync(full).isFile()) {
							rmSync(full, { force: true })
						}
					} catch {
						/* skip */
					}
				}
			} catch {
				/* skip */
			}
		}

		// Delete the stage branch. The next haiku_run_next will fork a
		// fresh one from intent main as needed.
		if (willDeleteBranch) {
			try {
				deleteStageBranch(slug, stage)
			} catch (err) {
				// Non-fatal — the directory wipe already happened. Surface
				// the branch-delete error in the response.
				return text(
					JSON.stringify({
						action: "stage_reset_partial",
						slug,
						stage,
						message: `Stage '${stage}' state wiped but \`${stageBranch}\` branch could not be deleted: ${err instanceof Error ? err.message : String(err)}. Delete it manually with \`git branch -D ${stageBranch}\` then run \`haiku_run_next\`.`,
					}),
				)
			}
		}

		gitCommitState(`haiku: reset stage ${stage} on ${slug}`)

		return text(
			JSON.stringify(
				{
					action: "stage_reset",
					slug,
					stage,
					wiped: candidates,
					message: `Stage '${stage}' has been reset. Call \`haiku_run_next { intent: "${slug}" }\` to re-enter the stage at its elaborate phase.`,
				},
				null,
				2,
			),
		)
	},
})
