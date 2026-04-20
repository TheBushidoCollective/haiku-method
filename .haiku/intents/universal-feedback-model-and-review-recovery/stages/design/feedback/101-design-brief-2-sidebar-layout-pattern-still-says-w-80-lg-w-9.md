---
title: >-
  DESIGN-BRIEF §2 sidebar-layout pattern still says `w-80 lg:w-96`, unit-16
  canonical is `w-80 xl:w-96`
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:28:44Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

Separate-but-related finding to the `lg:w-96` vs `xl:w-96` cutover. Specifically scoped to the internal inconsistency WITHIN DESIGN-BRIEF.

DESIGN-BRIEF §2 "Design Language Reference > Component Patterns" line 38 declares:

> - **Sidebar layout**: `w-80 lg:w-96 shrink-0 sticky top-16 h-[calc(100vh-4rem)] flex-col`

DESIGN-BRIEF §4 "Responsive Behavior" line 662-666 declares:

> **Canonical breakpoint note (unit-16).** The desktop cutover is **1280px** (Tailwind `xl`). The sidebar uses the canonical pair `w-80 xl:w-96` — 320px below `xl`, 384px at `xl` and above. `lg:` (1024px) is an intermediate breakpoint used for layout transitions only; the width change sits at `xl:`.

> **Desktop (>= 1280px, `xl:`)**
> - Sidebar width: canonical pair `w-80 xl:w-96` — widens to 384px at the `xl` breakpoint.

So §2 line 38 says `lg:w-96` (1024px cutover) and §4 says `xl:w-96` (1280px cutover). The DESIGN-BRIEF contradicts itself. §2 line 38 is the "Design Language Reference" block that dev-stage React will copy verbatim into component code. Every other responsive callout in §4 uses `xl:`.

Fix: rewrite DESIGN-BRIEF.md:38 from `w-80 lg:w-96 ...` to `w-80 xl:w-96 ...` to match §4 line 666 and unit-16 gate 5.

Post-fix verification: `grep -n 'Sidebar layout' stages/design/DESIGN-BRIEF.md` returns one line with `xl:w-96`. `grep -n 'lg:w-96' stages/design/DESIGN-BRIEF.md` returns 0 occurrences (legitimate uses of `lg:` in layout transitions use other classes, not `w-96`).

Cross-reference: this ties into FB-87 (assessor-summary-card `lg:w-96` drift) — both share the same root cause and should be closed in the same bolt.
