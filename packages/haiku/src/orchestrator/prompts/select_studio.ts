// orchestrator/prompts/select_studio.ts — Tells the agent to call
// haiku_select_studio so the user can pick a lifecycle template.
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

import { definePromptBuilder } from "./define.js"

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

	return `## Studio Selection Required

This intent has no studio selected yet. The user will pick via an elicitation prompt — your job is to pre-narrow the choices so they don't have to scroll through every studio in the registry.

### Available Studios

${studioListing || emptyFallback}

### Required Next Step

1. **Recall the intent description you just wrote** — it's in your conversation context, no need to re-read. (Direct \`Read\` on \`intent.md\` is blocked by the workflow-fields hook anyway; the description lives in the body, so \`haiku_intent_get\` doesn't fetch it either. Just use what you already have in context.) Pick the **2–4 studios** from the list above that best fit.
2. **Call \`haiku_select_studio { intent: "${slug}", options: ["<studio-1>", "<studio-2>", ...] }\`** with those names. Use the canonical \`name\` from the list (e.g. \`"product"\`, \`"design"\`); slugs and aliases also resolve.

The elicitation will show your shortlist plus a **"Show all studios…"** escape, so narrowing is never lossy — if the user wants more, one click re-elicits the full list. If you genuinely cannot narrow (description is too generic, or every studio is plausible), call with no \`options\` and the user gets the full list.`
})
