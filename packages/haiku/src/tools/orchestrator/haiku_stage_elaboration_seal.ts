// tools/orchestrator/haiku_stage_elaboration_seal.ts — Verifier-only
// stamp that flips the per-stage elaboration artifact from "captured"
// to "verified."
//
// Called by the verifier subagent dispatched via the
// `elaborate_review` cursor action (see `prompts/elaborate_review.ts`).
// The verifier reads the elaboration artifact + intent + STAGE.md,
// grades for substance, and on pass calls this tool to stamp
// `verified_at: <ISO>` on the artifact's frontmatter. Optional
// `notes` are stored as `verified_notes` for the audit trail.
//
// On fail, the verifier does NOT call this tool — it surfaces gaps
// to the outer agent, who re-engages the user and re-records the
// artifact (which clears any stale verified_at because record
// overwrites the file wholesale).

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { ensureOnStageBranch } from "../../git-worktree.js"
import {
	HAIKU_STAGE_ELABORATION_SEAL_INPUT_SCHEMA,
	validateHaikuStageElaborationSealInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { findHaikuRoot, gitCommitState } from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_stage_elaboration_seal",
	description:
		"Stamp `verified_at` on the per-stage elaboration artifact's frontmatter. The verifier subagent calls this on a pass; the agent must NOT call it directly. Stamps the verification timestamp and optional notes, freeing the cursor to advance past `elaborate_review`. Idempotent (no-op when already verified).",
	inputSchema: jsonSchemaOf(HAIKU_STAGE_ELABORATION_SEAL_INPUT_SCHEMA),
	handle(args) {
		const validation = validateToolInput(
			args as Record<string, unknown>,
			validateHaikuStageElaborationSealInputSchema,
			"haiku_stage_elaboration_seal",
		)
		if (validation) return validation

		const slug = args.intent as string
		const stage = args.stage as string
		const notes = (args.notes as string | undefined) ?? ""

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
								tool: "haiku_stage_elaboration_seal",
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
								tool: "haiku_stage_elaboration_seal",
								message: `No elaboration artifact at ${elabPath}. The agent must call \`haiku_stage_elaboration_record\` before the verifier can seal it.`,
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
						text: `Error: branch enforcement failed for elaboration seal on '${slug}/${stage}' — ${branchGuard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		const raw = readFileSync(elabPath, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as Record<string, unknown>

		// Idempotent: if already verified, return noop.
		if (typeof fm.verified_at === "string" && fm.verified_at) {
			return text(
				JSON.stringify(
					{
						action: "noop",
						slug,
						stage,
						path: elabPath,
						verified_at: fm.verified_at,
						message: `Elaboration for '${slug}/${stage}' is already verified.`,
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

		writeFileSync(elabPath, matter.stringify(parsed.content, updatedFm))

		gitCommitState(`haiku: seal elaboration for ${slug}/${stage}`)

		return text(
			JSON.stringify(
				{
					action: "elaboration_sealed",
					slug,
					stage,
					path: elabPath,
					verified_at: verifiedAt,
					...(notes.trim() ? { verified_notes: notes.trim() } : {}),
					message: `Sealed elaboration for '${slug}/${stage}'. The cursor will advance past elaborate on the next tick.`,
				},
				null,
				2,
			),
		)
	},
})
