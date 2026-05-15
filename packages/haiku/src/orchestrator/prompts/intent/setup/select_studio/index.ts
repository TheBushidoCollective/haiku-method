// orchestrator/prompts/select_studio/index.ts — Tells the agent to
// call haiku_select_studio so the user can pick a lifecycle template.
//
// Pre-narrow contract (load-bearing for UX): the action carries
// `available_studios` as the full studio registry. The agent has the
// intent description it just authored, so it should pick the 2-4
// studios most likely to fit and pass them as `options` on the call.
// The tool's elicitation then shows that subset PLUS a "Show all
// studios..." escape, which re-elicits with the full list when the
// user wants more.
//
// Without this directive the agent calls the tool with no `options`,
// the elicitation falls through to the full list, and the user picks
// from N studios on every intent — exactly the noise we hear about.
//
// Why agent-side instead of engine-side ranking: the agent already
// has the description in context (it just wrote it) and can do a
// semantically-aware top-N pick for free. Engine-side keyword
// overlap would be a second-order signal we'd have to maintain.

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
