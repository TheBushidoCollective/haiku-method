## Studio Selection Required

This intent has no studio selected yet. The user will pick via an elicitation prompt — your job is to pre-narrow the choices so they don't have to scroll through every studio in the registry.

### Available Studios

<% if (studioListing) { %>
<%~ studioListing %>
<% } else { %>
<%~ emptyFallback %>
<% } %>

### Required Next Step

1. **Recall the intent description you just wrote** — it's in your conversation context, no need to re-read. (Direct `Read` on `intent.md` is blocked by the workflow-fields hook anyway; the description lives in the body, so `haiku_intent_get` doesn't fetch it either. Just use what you already have in context.) Pick the **2–4 studios** from the list above that best fit.
2. **Call `haiku_select_studio { intent: "<%= slug %>", options: ["<studio-1>", "<studio-2>", ...] }`** with those names. Use the canonical `name` from the list (e.g. `"product"`, `"design"`); slugs and aliases also resolve.

The elicitation will show your shortlist plus a **"Show all studios…"** escape, so narrowing is never lossy — if the user wants more, one click re-elicits the full list. If you genuinely cannot narrow (description is too generic, or every studio is plausible), call with no `options` and the user gets the full list.
