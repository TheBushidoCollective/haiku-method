// orchestrator/prompts/select_studio/index.ts — Rendered for the
// `select_studio` action. NOTE: in the normal tick path the agent
// never sees this — `haiku_run_next` intercepts `select_*` actions and
// runs the SPA picker inline (2026-05-07). This prompt is the fallback
// surface for direct / foreign callers.
//
// Pre-narrow contract (load-bearing for UX): the studio picker should
// show a 2–4 studio shortlist FIRST, with the rest behind a "Show all
// studios…" expansion — not the whole registry on every intent. That
// shortlist comes from `studio_candidates`, which the agent stamps on
// intent.md at CREATE time (it has the description in context then) and
// `haiku_select_studio` reads when it opens the picker. The full
// registry always rides along, so narrowing is never lossy.
//
// Why agent-side (at create) instead of engine-side ranking: the agent
// already has the description in context and can do a semantically-
// aware top-N pick for free. Engine-side keyword overlap would be a
// second-order signal we'd have to maintain. Why at create rather than
// here: the 2026-05-07 change keeps the agent out of the select_* tick
// loop entirely, so create is the only point the agent is in the loop.
//
// `available_studios` on the action is currently unpopulated; the
// listing falls through to the empty fallback for foreign callers.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

interface AvailableStudio {
	name: string
	slug?: string
	aliases?: string[]
	description?: string
	category?: string
}

export default definePromptBuilder(({ slug, action }) => {
	const available = (action.available_studios as AvailableStudio[]) ?? []
	const studioListing = available
		.map((s) => {
			const slugPart = s.slug && s.slug !== s.name ? ` (\`${s.slug}\`)` : ""
			const desc = s.description ? ` — ${s.description}` : ""
			return `- **${s.name}**${slugPart}${desc}`
		})
		.join("\n")
	const emptyFallback = `_(no studios found in the registry — call \`haiku_select_studio { intent: "${slug}" }\` to surface the conversational fallback)_`
	return eta.renderString(TEMPLATE, { slug, studioListing, emptyFallback })
})
