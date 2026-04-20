---
title: >-
  Magic-number max-w / w / min-h / h / rounded literals across 9+ artifacts
  bypass DESIGN-TOKENS sizing tokens
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:52:15Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-BRIEF §4 "Responsive Behavior" canonicalizes `max-w-page` (backed by `--max-page-width` CSS variable per `knowledge/DESIGN-TOKENS.md §1.3`) for page-wrapper max-widths, and the consistency mandate requires that "all spacing, typography, and color values reference named tokens — no raw hex, px, or magic numbers."

Stage-wide grep `grep -rEn 'max-w-\[[0-9]+px\]|w-\[[0-9]+px\]|min-h-\[[0-9]+px\]|h-\[[0-9]+px\]' stages/design/artifacts/*.html` returns 30+ magic-number sites across 9 artifacts.

Distinct violation classes:

1. **Page-wrapper max-widths** — should use `max-w-page`:
   - `agent-feedback-toggle-spec.html:37` — `max-w-[960px] mx-auto`
   - `assessor-summary-card.html:15, 24` — `max-w-[1400px] mx-auto` (also FB-88 regression)
   - `focus-ring-spec.html:80` — `max-w-[1000px] mx-auto`

2. **Raw-px component widths** — should use a tokenized sidebar/popover width or a Tailwind scale:
   - `annotation-popover-states.html:424` — phone frame mockup `w-[375px] h-[560px] rounded-[28px]` — the 28px radius doesn't match DESIGN-TOKENS.md §1.5 radius inventory (only `rounded-xl/full/lg/md/sm`).
   - `comment-to-feedback-flow.html:349, 395, 757` — popover wrappers at `w-[140px]`, `w-[160px]`, `max-w-[220px]`.
   - `feedback-inline-desktop.html:136, 160, 211` — floating annotation containers at `w-[300px]`, `w-[240px]` pinned via `-right-[340px]`.
   - `review-context-header.html:75, 139` — brand diamonds at `w-[18px] h-[18px]`.
   - `rollback-reason-banner.html:219, 265` — blocked-gate panel at `max-w-[384px]`.

3. **Magic-number min-heights**:
   - `comment-to-feedback-flow.html:221, 350, 457, 924` — textarea min-heights at `min-h-[40px]`, `min-h-[32px]`, `min-h-[48px]`.
   - `comments-list-with-agent-toggle.html:113, 229` — main-pane placeholders at `min-h-[640px]`, `min-h-[540px]`.
   - `feedback-inline-mobile.html:176` — badge at `min-w-[20px] h-[20px]`.

4. **Magic-number radii** — `annotation-popover-states.html:424` uses `rounded-[28px]`, not in the §1.5 inventory.

Consistency effect:
- The `max-w-page` utility was introduced precisely to eliminate the 1400 / 960 / 1000 / 384 drift — the fact that 5 artifacts declare their own page-width means that a future `--max-page-width` change only propagates to 60% of surfaces.
- Dev stage will have to hand-translate each magic-number width into the React component, multiplying the drift surface.

Fix:
1. **Page wrappers** — replace `max-w-[960px] / [1000px] / [1400px]` with `max-w-page` on every spec / artifact header + main wrapper. Already land-patterned in `rollback-reason-banner.html` (:20, :29) and `feedback-inline-desktop.html` (:105).
2. **Component widths / min-heights** — introduce (or cite if already present) named tokens in DESIGN-TOKENS.md §1.6 Sizing for the recurring values (`popover-width: 300px`, `phone-frame: {w: 375px, h: 560px, r: 28px}`, `textarea-minh-{sm,md,lg}: {32, 40, 48}px`). Rewrite every artifact to reference tokens.
3. **`rounded-[28px]`** — add `rounded-3xl` (1.5rem / 24px — closest native Tailwind) to DESIGN-TOKENS.md §1.5 or cite a new `rounded-phone` token if 28px is load-bearing. Replace the inline literal.

Post-fix gate (add to design-reviewer):
`grep -rEn 'max-w-\[[0-9]+px\]|w-\[[0-9]+px\]|min-h-\[[0-9]+px\]|h-\[[0-9]+px\]|rounded-\[[0-9]+px\]' stages/design/artifacts/*.html` → 0 matches (or every remaining match carries an inline `demo-only` comment with rationale).
