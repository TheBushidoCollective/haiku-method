// tools/orchestrator/haiku_stage_elaboration_record.ts — Capture the
// per-stage human-conversation outcome on disk.
//
// Called by the agent during the per-stage `elaborate` cursor action,
// after the conversation with the user has reached alignment. Writes
// `stages/<stage>/elaboration.md` with frontmatter:
//   - recorded_at: ISO timestamp
//   - intent: slug
//   - stage: stage name
//   - verified_at: <unset until the verifier seals>
//
// Subsequent calls overwrite the artifact. This is intentional — when
// the verifier rejects a thin conversation, the agent re-engages the
// user, calls this tool again with the updated body, and the
// freshly-written artifact has no `verified_at` (the verifier must
// re-pass).
//
// The cursor blocks at `elaborate` until this tool is called AND the
// verifier seals the artifact. See `cursor.ts` walkIntentTrack
// "Elaborate gate" clause and `prompts/elaborate.ts` for the
// agent-facing instructions.

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { clearNonce } from "../../orchestrator/workflow/verifier-nonce.js"
import {
	HAIKU_STAGE_ELABORATION_RECORD_INPUT_SCHEMA,
	validateHaikuStageElaborationRecordInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { findHaikuRoot, gitCommitState } from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_stage_elaboration_record",
	description:
		"Capture the per-stage human-conversation outcome at `stages/<stage>/elaboration.md`. Call this when the conversation with the user has reached alignment for the active stage's `elaborate` action. The artifact's frontmatter records `recorded_at`; `verified_at` is stamped separately by the verifier subagent. Overwrites any prior artifact (clearing a stale `verified_at`). Cursor stays at `elaborate_review` until the verifier seals the artifact.",
	inputSchema: jsonSchemaOf(HAIKU_STAGE_ELABORATION_RECORD_INPUT_SCHEMA),
	handle(args) {
		const validation = validateToolInput(
			args as Record<string, unknown>,
			validateHaikuStageElaborationRecordInputSchema,
			"haiku_stage_elaboration_record",
		)
		if (validation) return validation

		const slug = args.intent as string
		const stage = args.stage as string
		const body = args.body as string

		const root = findHaikuRoot()
		const intentDir = join(root, "intents", slug)

		if (!existsSync(intentDir)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: "intent_not_found",
								tool: "haiku_stage_elaboration_record",
								message: `Intent '${slug}' not found.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		const stageDir = join(intentDir, "stages", stage)
		// Note: `stages/<stage>/` may not exist yet on a truly fresh
		// stage — the cursor fires `elaborate` BEFORE any unit specs
		// land, so the agent's first call here is exactly the moment
		// the stage directory needs to be created. The mkdirSync
		// below handles that (idempotent under `{ recursive: true }`).
		// We don't gate on `existsSync(stageDir)` because that would
		// reject every fresh-stage call with `stage_not_found` and
		// permanently block the gate. The intent existence check
		// above is the real validation.

		// Ensure we're on the right branch before writing. Stage-scoped
		// artifacts land on the stage branch, like every other per-stage
		// engine-managed file.
		const branchGuard = ensureOnStageBranch(slug, stage)
		if (!branchGuard.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: branch enforcement failed for elaboration record on '${slug}/${stage}' — ${branchGuard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		mkdirSync(stageDir, { recursive: true })

		const elabPath = join(stageDir, "elaboration.md")
		const recordedAt = new Date().toISOString()
		const fm = {
			recorded_at: recordedAt,
			intent: slug,
			stage,
		}
		writeFileSync(elabPath, matter.stringify(body, fm))

		// Overwriting the artifact wholesale invalidates any in-flight
		// verifier that was dispatched against the prior body. Clear the
		// stale nonces so a stale verifier subagent can't seal the new
		// body — the next tick mints fresh nonces tied to the new
		// `recorded_at`.
		clearNonce({ kind: "stage_elaborate", slug, stage })
		clearNonce({ kind: "stage_decompose", slug, stage })

		gitCommitState(`haiku: record elaboration for ${slug}/${stage}`)

		return text(
			JSON.stringify(
				{
					action: "elaboration_recorded",
					slug,
					stage,
					path: elabPath,
					recorded_at: recordedAt,
					message: `Captured elaboration for '${slug}/${stage}'. The cursor will dispatch the verifier on the next tick.`,
				},
				null,
				2,
			),
		)
	},
})
