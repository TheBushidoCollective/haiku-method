// orchestrator/prompts/intent/seal/pending_seal/index.ts — the
// pending-seal holding prompt.
//
// Cursor returns `pending_seal` when every stage is built, every
// intent-level approval is signed, reflection is done — but the
// intent's `haiku/<slug>/main` hub branch has NOT yet landed on the
// repo's default branch. The work is delivered to the change request;
// the change request hasn't merged. The intent is HELD here instead of
// sealed (`sealed_at` stays null), and the engine never performs the
// merge itself (honors "never merge unless asked"). It seals on a later
// tick once the merge lands. See `workflow/intent-delivery.ts`.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import matter from "gray-matter"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action, dir }) => {
	const defaultBranch =
		(action as { default_branch?: string }).default_branch ||
		"the default branch"
	// Surface the delivery PR/MR url if we stamped one at intent_create
	// (informational — the engine never gates on it). Read from intent.md
	// FM; absent when no provider CLI was available.
	let prUrl = ""
	try {
		const intentMd = join(dir, "intent.md")
		if (existsSync(intentMd)) {
			const fm = matter(readFileSync(intentMd, "utf8")).data as Record<
				string,
				unknown
			>
			if (typeof fm.draft_pr_url === "string") prUrl = fm.draft_pr_url
		}
	} catch {
		// best-effort — the prompt still renders without the link
	}
	return eta.renderString(TEMPLATE, {
		slug,
		defaultBranch,
		prUrl,
		intentMain: `haiku/${slug}/main`,
	})
})
