---
title: >-
  Sidebar-width canonical pair violated: DESIGN-BRIEF §2 and
  assessor-summary-card say `lg:w-96`, not `xl:w-96`
status: open
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:26:04Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

Unit-16 gate 5 (FB-47) declared the canonical sidebar pair as `w-80 xl:w-96` (desktop cutover at 1280 / Tailwind `xl`). Multiple sources still publish the older `lg:w-96` cutover, which directly contradicts the canonical:

- `stages/design/DESIGN-BRIEF.md:38` — "Design Language Reference > Sidebar layout" still reads `w-80 lg:w-96 shrink-0 sticky top-16 h-[calc(100vh-4rem)] flex-col`. This is the DESIGN-BRIEF's own design-language reference, so every downstream artifact that reads from it will drift back.
- `stages/design/artifacts/assessor-summary-card.html:302` — "desktop (1280px) — sidebar `lg:w-96`" explicitly contradicts the 1280px threshold by using the `lg:` prefix (1024px cutover).

Because DESIGN-BRIEF is the source-of-truth reference used by dev-stage React components, this drift will land in `ReviewSidebar.tsx` as `w-80 lg:w-96` — the exact legacy pattern unit-16 retired.

Fix: normalize to `w-80 xl:w-96` in DESIGN-BRIEF §2 line 38 and in assessor-summary-card.html §Responsive list. Cross-check DESIGN-TOKENS.md §1.3 (Spacing Tokens "Sidebar width") and §2.5 (Panel Shell) if they still carry the `lg:` variant.

Gate proof after fix: `grep -rEn 'lg:w-96' stages/design/ knowledge/DESIGN-TOKENS.md` returns 0 occurrences (only `xl:w-96` should remain).
