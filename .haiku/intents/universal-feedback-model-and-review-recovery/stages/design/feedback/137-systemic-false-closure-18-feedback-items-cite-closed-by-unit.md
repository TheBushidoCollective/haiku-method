---
title: >-
  Systemic false-closure: 18+ feedback items cite `closed_by: unit-26..31` but
  those units do not exist on disk
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:50:06Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

Cross-cutting consistency defect: the feedback ledger claims 18+ findings were closed by units 26–31 (the "canonical token normalization sweep", "assessor card rewrite", "stage-progress-strip rewrite", "contrast-gates-assert script", "focus-ring alignment", "grep-for-announce helper wiring") — but `stages/design/units/` only contains unit-01 through unit-25. The delegated units were never produced.

Sampled false closures (checked against live artifacts, all still violate the gate they were supposedly fixing):

- FB-88 (`max-w-[1400px]` → `max-w-page`): `closed_by: unit-28-canonical-token-normalization-sweep` — unit-28 missing; violations live in `assessor-summary-card.html:15,24`.
- FB-89 (`gray-*` → `stone-*` sweep): `closed_by: unit-28-canonical-token-normalization-sweep` — unit-28 missing; 13 violations live in `stage-progress-strip.html`.
- FB-92 (`opacity-60` on locked cards): `closed_by: unit-28-canonical-token-normalization-sweep` — 9 violations live in `revisit-unit-list.html`.
- FB-99 (bare `rounded` class): `closed_by: unit-28-canonical-token-normalization-sweep` — 10+ violations live in `feedback-card-states.html`.
- FB-100, FB-101, FB-102, FB-103, FB-104, FB-105, FB-106, FB-107, FB-108, FB-109, FB-110 (feedback items that cite units 26/27/28/29/30/31 per FB-111..FB-123 sibling-conflict findings) — verification needed but the pattern suggests all of these have the same false-closure defect.

Verification command:
```
ls stages/design/units/ | sort   # returns unit-01 .. unit-25, nothing above
grep -rEn 'closed_by: unit-(2[6-9]|3[01])' stages/design/feedback/ | wc -l   # > 0
```

This is a **pipeline-consistency** defect: the fix-loop advanced `status: closed` on the feedback files without the referenced unit ever existing. Every subsequent adversarial-review cycle that trusts the `closed` status will miss live regressions.

Fix — two parts:

1. **Reopen** every feedback item whose `closed_by` points to a non-existent unit. A mechanical sweep:
   `for f in stages/design/feedback/*.md; do
     ref=$(grep -E '^closed_by:' "$f" | awk -F': ' '{print $2}')
     [ -n "$ref" ] && [ ! -f "stages/design/units/${ref}.md" ] && echo "$f → ${ref} missing"
   done`
   Every listed file needs `status:` flipped back to `pending` (or `addressed` if the fix landed under a different unit name) and `closed_by:` cleared / corrected.

2. **Ledger-integrity gate**: add a gate to the design-reviewer hat that runs the command above and fails if any row prints. This prevents the "ghost-unit closes feedback" anti-pattern from silently recurring.

Without this, the entire "closed-by-unit-28" generation of feedback is a false-negative set that will keep resurfacing in every downstream adversarial cycle.
