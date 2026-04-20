---
title: >-
  Sidebar width canonical pair diverges: BRIEF/TOKENS say lg:w-96, unit-16 gate
  says xl:w-96
status: rejected
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T02:56:38Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

Three documents in this stage declare different "canonical" sidebar-width tokens for the same review sidebar. Downstream artifacts pick whichever they like, and the unit-16 gate ostensibly enforcing one of them is failing.

1. **`DESIGN-BRIEF.md §1 Layout Structure** (line 74 ASCII diagram and §4 line 593):** declares `w-80` tablet / `w-96` (no prefix) desktop. The "Design Language Reference" (line 38) specifies `w-80 lg:w-96 shrink-0 sticky top-16 h-[calc(100vh-4rem)] flex-col` as the canonical sidebar layout.
2. **`knowledge/DESIGN-TOKENS.md §1.3 Spacing Tokens** (line 101):** declares `Sidebar width | w-80 lg:w-96`. Same as BRIEF.
3. **`knowledge/DESIGN-TOKENS.md §2.5 Panel Shell** (line 383):** declares `w-80 lg:w-96 shrink-0 sticky top-16 h-[calc(100vh-4rem)]`.
4. **`units/unit-16-global-token-normalization-sweep.md` quality gate (lines 81-84):** declares "Sidebar widths canonical: `w-80 xl:w-96`" — i.e. `xl:` (1280px), not `lg:` (1024px).

So DESIGN-BRIEF + DESIGN-TOKENS both use `lg:` and unit-16 flips to `xl:` without updating either upstream doc. Unit-16 also requires `w-80 xl:w-96` on every sidebar root but none of the 8 `w-80\\b|w-96\\b` occurrences in `stages/design/artifacts/` actually use that pair — actual uses include bare `w-80` (`feedback-inline-desktop.html:357`, `rollback-reason-banner.html:213`), bare `w-96` (`comments-list-with-agent-toggle.html:117,233`), and `lg:w-96` (`assessor-summary-card.html:302`, `comments-list-with-agent-toggle.html:394`).

On top of that, unit-16 gate 8 flips the desktop breakpoint threshold from **1024px** to **1280px** but DESIGN-BRIEF §4 Responsive Behavior still says "Desktop (>= 1024px, `lg:`)" on line 591, and DESIGN-TOKENS does not carry a breakpoint table at all. The `lg:w-96` uses in artifacts are therefore consistent with DESIGN-BRIEF and DESIGN-TOKENS but inconsistent with the unit-16 gate.

**Recommended fix:** pick one.
- Keep `lg:w-96` (1024px cutover) — then rewrite unit-16 gates 5 and 8 to match, reopen FB-47 and FB-52 as not-fixed, and re-verify downstream units depending on breakpoint semantics.
- Switch to `xl:w-96` (1280px cutover) — then rewrite DESIGN-BRIEF §1 line 38, §4 lines 591-593, and DESIGN-TOKENS §1.3 line 101 / §2.5 line 383 to match, plus every artifact that currently renders `lg:w-96`.

Until this is resolved, every downstream unit that picks a sidebar width is guessing.

---

**Rejection reason:** Canonical chosen: `w-80 xl:w-96` (1280px cutover, matches unit-16 gate and canonical breakpoint table in DESIGN-TOKENS.md §1.5). DESIGN-BRIEF and DESIGN-TOKENS will be sync-swept in unit-20. Dropping this as a standalone finding — covered by unit-20's doc-alignment gate.
