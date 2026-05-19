---
interpretation: lens
---
**Mandate:** The agent **MUST** be the audience's eyes for marketing content — render every landing page, email, social asset, or campaign surface in a real browser at every declared device size and verify the content reads, links work, CTAs are clickable, and tracking fires before launch. Static review of a copy doc or a Figma export cannot catch a CTA button that opens to a 404, an image that breaks at mobile breakpoint, or analytics that silently never fire because the gtag snippet is malformed.

## Check

Open a view session via `haiku_view({ stage: "content" })`. Boot mode when the project ships a runnable preview (Next.js / Astro / static-site dev server); viewer mode for standalone HTML / Markdown / image assets. Call `browser_take_screenshot` for every page at every declared breakpoint. **Save each screenshot** to disk under `.haiku/intents/<intent>/stages/content/proof/<page-slug>-<breakpoint>.png` using the `Write` tool.

The agent **MUST** verify each of the following:

- **Every page renders at every declared breakpoint.** Resize via `browser_resize` to mobile, tablet, desktop (or whatever breakpoints the brand guide names). Layout breaks, overflowing text, images that crop the subject, hero CTAs hidden below the fold on mobile — all findings.
- **Every CTA goes somewhere real.** Click each call-to-action via `browser_click`. The destination must be a live URL — not a 404, not a redirect to the homepage, not a stale staging URL. Forms that submit MUST land on a thank-you page or show a visible success state.
- **Tracking pixels / analytics fire.** Use `browser_network_requests` (or equivalent) to confirm the page's declared tracking endpoints actually receive requests at the right moments — page-load, CTA click, form submit. A campaign that ships without tracking is silently un-attributable.
- **Brand-token compliance in the rendered output.** Colors, typography, logo treatment, image styling all match the brand system the strategy stage declared. Off-brand color slipping in via a default style is a finding even when the source file looks correct.
- **Accessibility minimums.** Alt text on hero images, contrast ratios on text-on-photo overlays, keyboard navigability of CTAs, focus indicators on interactive elements. A campaign that fails AA contrast is a campaign that excludes a measurable audience segment.
- **Per-unit claims hold.** Read every content unit body. Each unit's claimed deliverable — a particular page, a specific copy block, a named asset — MUST be visible in the rendered output.
- **Close the session.** Call `haiku_view_close({ session_id })` after all checks complete.

## Common failure modes to look for

- Hero CTA that links to `/signup?ref=launch-campaign` but the URL parameter convention changed during the build — the link works, attribution silently fails
- Image hero that looks crisp at desktop but the focal-point crops the subject's face on mobile
- Form that submits to a staging endpoint because the production URL was never swapped in
- Analytics snippet present in the source but blocked by the project's CSP — the page renders, tracking never fires
- Brand color used via a one-off hex `#0a7fa3` instead of the token — passes a copy review, fails brand audit
- A unit body that claims "added testimonial section with three quotes" but the rendered page only shows two because one quote's image asset is broken and the section collapses
