// tools/orchestrator/haiku_stage_decompose_seal.ts — Verifier-only
// stamp that flips the per-stage elaboration artifact's decompose
// state from "drafted" to "verified."
//
// Called by the verifier subagent dispatched via the `decompose_review`
// cursor action (see `prompts/decompose_review.ts`). The verifier
// reads the elaboration artifact + every unit in the stage, audits
// that the units collectively cover the captured conversation, and on
// pass calls this tool to stamp `decompose_verified_at: <ISO>` on the
// artifact's frontmatter. Optional `notes` are stored as
// `decompose_verified_notes` for the audit trail.
//
// On fail, the verifier does NOT call this tool — it files feedback
// with `targets.invalidates: ["decompose_complete"]` so the fix loop
// reruns decomposition.
//
// This is the 4th elaborate-loop completion signal per GOALS.md.
// The first three are: discovery artifacts on disk, no open
// origin:discovery resolution:question FBs, and the elaborate gate
// itself (verified_at on elaboration.md from the conversation
// verifier). All four flip on disk → cursor advances past elaborate
// into the pre-execution review track.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { consumeNonce } from "../../orchestrator/workflow/verifier-nonce.js"
import {
	HAIKU_STAGE_DECOMPOSE_SEAL_INPUT_SCHEMA,
	validateHaikuStageDecomposeSealInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { findHaikuRoot, gitCommitState } from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_stage_decompose_seal",
	description:
		"Stamp `decompose_verified_at` on the per-stage elaboration artifact's frontmatter. The decompose-verifier subagent calls this on a pass; the agent must NOT call it directly. Stamps the verification timestamp and optional notes, freeing the cursor to advance past `decompose_review`. Idempotent (no-op when already verified).",
	inputSchema: jsonSchemaOf(HAIKU_STAGE_DECOMPOSE_SEAL_INPUT_SCHEMA),
	handle(args) {
		const validation = validateToolInput(
			args as Record<string, unknown>,
			validateHaikuStageDecomposeSealInputSchema,
			"haiku_stage_decompose_seal",
		)
		if (validation) return validation

		const slug = args.intent as string
		const stage = args.stage as string
		const nonce = args.nonce as string
		const notes = (args.notes as string | undefined) ?? ""

		const nonceCheck = consumeNonce(
			{ kind: "stage_decompose", slug, stage },
			nonce,
		)
		if (!nonceCheck.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: "verifier_nonce_invalid",
								tool: "haiku_stage_decompose_seal",
								reason: nonceCheck.reason,
								message:
									nonceCheck.reason === "missing"
										? `No pending decompose-verifier nonce for '${slug}/${stage}'. The cursor only mints a nonce when emitting the decompose_review action — call haiku_run_next first, dispatch the verifier subagent with the nonce on the action payload, then have the subagent call this tool with that nonce.`
										: `Decompose-verifier nonce for '${slug}/${stage}' does not match the cursor's pending value. If the elaboration was re-recorded since the verifier was dispatched, the nonce was rotated — re-tick to get the new value.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

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
								tool: "haiku_stage_decompose_seal",
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

		const elabPath = join(intentDir, "stages", stage, "elaboration.md")
		if (!existsSync(elabPath)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: "elaboration_not_found",
								tool: "haiku_stage_decompose_seal",
								message: `No elaboration artifact at ${elabPath}. The conversation-elaborate gate must pass before decompose-verify can stamp it.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		const branchGuard = ensureOnStageBranch(slug, stage)
		if (!branchGuard.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: branch enforcement failed for decompose seal on '${slug}/${stage}' — ${branchGuard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		const raw = readFileSync(elabPath, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as Record<string, unknown>

		// Idempotent: if already verified, return noop.
		if (
			typeof fm.decompose_verified_at === "string" &&
			fm.decompose_verified_at
		) {
			return text(
				JSON.stringify(
					{
						action: "noop",
						slug,
						stage,
						path: elabPath,
						decompose_verified_at: fm.decompose_verified_at,
						message: `Decompose for '${slug}/${stage}' is already verified.`,
					},
					null,
					2,
				),
			)
		}

		const verifiedAt = new Date().toISOString()
		const updatedFm: Record<string, unknown> = {
			...fm,
			decompose_verified_at: verifiedAt,
		}
		if (notes.trim()) {
			updatedFm.decompose_verified_notes = notes.trim()
		}

		writeFileSync(elabPath, matter.stringify(parsed.content, updatedFm))

		gitCommitState(`haiku: seal decompose for ${slug}/${stage}`)

		return text(
			JSON.stringify(
				{
					action: "decompose_sealed",
					slug,
					stage,
					path: elabPath,
					decompose_verified_at: verifiedAt,
					...(notes.trim() ? { decompose_verified_notes: notes.trim() } : {}),
					message: `Sealed decompose for '${slug}/${stage}'. The cursor will advance past decompose_review on the next tick.`,
				},
				null,
				2,
			),
		)
	},
})
