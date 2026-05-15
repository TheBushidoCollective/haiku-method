// tools/orchestrator/haiku_intent_seal.ts — Verifier-only stamp that
// flips intent.md from "captured" to "verified" after the pre-intent
// elaboration substance check passes.
//
// Called by the verifier subagent dispatched via the pre-intent
// `elaborate_review` cursor action (the action with no `stage` field;
// see `prompts/elaborate_review.ts`). The verifier reads intent.md
// and grades for substance. On pass it calls this tool to stamp
// `verified_at: <ISO>` on the intent's frontmatter, freeing the
// cursor to walk into the first stage's elaborate gate.
//
// On fail, the verifier does NOT call this tool — it surfaces gaps
// to the outer agent, who re-engages the user and updates intent.md.
// Updates that change intent.md's body do not automatically clear
// `verified_at` (intent.md isn't overwritten wholesale the way
// stage elaboration artifacts are), so a follow-up rejection requires
// the outer agent to call `haiku_intent_set { field: "verified_at",
// value: null }` if it wants to force re-verification.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { consumeNonce } from "../../orchestrator/workflow/verifier-nonce.js"
import {
	HAIKU_INTENT_SEAL_INPUT_SCHEMA,
	validateHaikuIntentSealInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { findHaikuRoot, gitCommitState } from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_intent_seal",
	description:
		"Stamp `verified_at` on intent.md frontmatter after the pre-intent substance verifier passes. Verifier subagent calls this on a pass; the agent must NOT call it directly. Stamps the verification timestamp and optional notes, freeing the cursor to advance past the pre-intent `elaborate_review` gate. Idempotent (no-op when already verified).",
	inputSchema: jsonSchemaOf(HAIKU_INTENT_SEAL_INPUT_SCHEMA),
	handle(args) {
		const validation = validateToolInput(
			args as Record<string, unknown>,
			validateHaikuIntentSealInputSchema,
			"haiku_intent_seal",
		)
		if (validation) return validation

		const slug = args.intent as string
		const nonce = args.nonce as string
		const notes = (args.notes as string | undefined) ?? ""

		const nonceCheck = consumeNonce({ kind: "intent_elaborate", slug }, nonce)
		if (!nonceCheck.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: "verifier_nonce_invalid",
								tool: "haiku_intent_seal",
								reason: nonceCheck.reason,
								message:
									nonceCheck.reason === "missing"
										? `No pending intent-elaboration verifier nonce for '${slug}'. The cursor only mints a nonce when emitting the pre-intent elaborate_review action — call haiku_run_next first, dispatch the verifier subagent with the nonce on the action payload, then have the subagent call this tool with that nonce.`
										: `Intent-elaboration verifier nonce for '${slug}' does not match the cursor's pending value.`,
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
		const intentMdPath = join(root, "intents", slug, "intent.md")

		if (!existsSync(intentMdPath)) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: "intent_not_found",
								tool: "haiku_intent_seal",
								message: `Intent '${slug}' not found at ${intentMdPath}.`,
							},
							null,
							2,
						),
					},
				],
				isError: true,
			}
		}

		// Pre-intent seal lands on intent main (not a stage branch) —
		// the seal precedes any stage walk.
		const branchGuard = ensureOnStageBranch(slug, undefined)
		if (!branchGuard.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: branch enforcement failed for intent seal '${slug}' — ${branchGuard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		const raw = readFileSync(intentMdPath, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as Record<string, unknown>

		// Idempotent: if already verified, return noop.
		if (typeof fm.verified_at === "string" && fm.verified_at) {
			return text(
				JSON.stringify(
					{
						action: "noop",
						slug,
						path: intentMdPath,
						verified_at: fm.verified_at,
						message: `Intent '${slug}' is already verified.`,
					},
					null,
					2,
				),
			)
		}

		const verifiedAt = new Date().toISOString()
		const updatedFm: Record<string, unknown> = {
			...fm,
			verified_at: verifiedAt,
		}
		if (notes.trim()) {
			updatedFm.verified_notes = notes.trim()
		}

		writeFileSync(intentMdPath, matter.stringify(parsed.content, updatedFm))
		gitCommitState(`haiku: seal pre-intent elaboration for ${slug}`)

		return text(
			JSON.stringify(
				{
					action: "intent_sealed",
					slug,
					path: intentMdPath,
					verified_at: verifiedAt,
					...(notes.trim() ? { verified_notes: notes.trim() } : {}),
					message: `Sealed pre-intent elaboration for '${slug}'. The cursor will walk into the first stage's elaborate gate on the next tick.`,
				},
				null,
				2,
			),
		)
	},
})
