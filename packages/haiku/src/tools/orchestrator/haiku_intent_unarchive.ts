// tools/orchestrator/haiku_intent_unarchive.ts — Remove the archived
// frontmatter key entirely (rather than leaving archived: false), so
// an unarchived intent looks pristine. Idempotent (no-op when not
// archived). Lands the write on intent-main.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { ensureOnStageBranch } from "../../git-worktree.js"
import { findHaikuRoot, gitCommitState } from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_intent_unarchive",
	description:
		"Unarchive an intent — clears the `archived` frontmatter flag so the intent reappears in default list views. Reversible via haiku_intent_archive. Does not prompt for confirmation.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent: { type: "string", description: "Intent slug to unarchive" },
		},
		required: ["intent"],
	},
	handle(args) {
		const slug = args.intent as string
		const root = findHaikuRoot()
		const intentFile = join(root, "intents", slug, "intent.md")

		if (!existsSync(intentFile)) {
			return {
				content: [
					{ type: "text" as const, text: `Intent '${slug}' not found.` },
				],
				isError: true,
			}
		}

		// Single-pass read: parse once with gray-matter, use it for both
		// the idempotency check and the write. Previously we
		// parseFrontmatter'd the file, checked archived, then re-read and
		// re-parsed inside matter() for the write — two full reads per
		// call.
		const raw = readFileSync(intentFile, "utf8")
		const parsed = matter(raw)

		if (parsed.data.archived !== true) {
			return text(
				JSON.stringify(
					{
						action: "noop",
						slug,
						path: intentFile,
						message: `Intent '${slug}' is not archived.`,
					},
					null,
					2,
				),
			)
		}

		// Unarchive is intent-scoped metadata — land on intent-main so the
		// mutation is visible everywhere, not split-brain on a stage
		// branch.
		const unarchiveGuard = ensureOnStageBranch(slug, undefined)
		if (!unarchiveGuard.ok) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: branch enforcement failed for intent unarchive '${slug}' — ${unarchiveGuard.message}. Resolve manually and retry.`,
					},
				],
				isError: true,
			}
		}

		// Remove the `archived` key entirely rather than leaving
		// `archived: false`. Cleaner: an unarchived intent looks pristine,
		// no trace of prior archival.
		const { archived: _archived, ...dataWithoutArchived } = parsed.data
		writeFileSync(
			intentFile,
			matter.stringify(parsed.content, dataWithoutArchived),
		)
		gitCommitState(`haiku: unarchive intent ${slug}`)

		return text(
			JSON.stringify(
				{
					action: "intent_unarchived",
					slug,
					path: intentFile,
					message: `Intent '${slug}' has been unarchived.`,
				},
				null,
				2,
			),
		)
	},
})
