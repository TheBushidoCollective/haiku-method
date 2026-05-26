## Studio Selection Required

This intent has no studio selected yet. Studio selection is engine-driven: the next `haiku_run_next` tick opens the SPA picker and blocks until the user chooses. You do **not** call a selection tool by hand.

You make that picker pre-narrowed at **creation time**, not here: pass `studio_candidates` to `haiku_intent_create` (the 2–4 studios that best fit what you described). The picker then shows your shortlist first and tucks the rest behind a **"Show all studios…"** expansion, so narrowing is never lossy — if the user wants more, one click reveals the full list.

### Available Studios

<% if (studioListing) { %>
<%~ studioListing %>
<% } else { %>
<%~ emptyFallback %>
<% } %>

### Required Next Step

Call `haiku_run_next` — the engine surfaces the picker and continues once the user picks. If you reached this prompt with a shortlist already stamped on the intent, the picker is already narrowed; otherwise it falls back to the full list above.
