---
title: >-
  unit-31 inputs list omits focus-ring-spec.html despite FB-105 citing it as a
  text-[11px] violation
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T15:30:58Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-31-contrast-and-type-scale-fixes.md
closed_by: null
bolt: 0
upstream_stage: null
---

File: `stages/design/units/unit-31-contrast-and-type-scale-fixes.md:12-18` (inputs/outputs)

FB-105 body explicitly lists `focus-ring-spec.html:108` as one of the text-[11px]-without-weight violations. unit-31 `closes: [FB-105, FB-106, FB-109]` but `inputs:` / `outputs:` do not include `focus-ring-spec.html`. The unit body §Out of scope says "focus-ring-spec.html:108 type-scale overlap — handled by unit-29 (same fix, different unit for scope coherence)."

This coordination is fine in principle, BUT:

1. unit-29's `inputs:` and `outputs:` DO include `focus-ring-spec.html`, and unit-29's gate (:76-89) lifts the :108 sample to `text-xs`. Good.
2. There is no `depends_on: [unit-29-focus-visible-canonicalization-and-spec-clarity]` on unit-31. If unit-31 runs first, unit-31's FB-105 closure check (re-running FB-105's literal grep recipe) will find a non-weight-paired text-[11px] at focus-ring-spec.html:108 and the gate FAILS — because unit-29 hasn't run yet.
3. unit-31's gate 3 entry (j) says "focus-ring-spec.html:108 — already covered by unit-29 (lifted to text-xs); this unit does not re-touch it." But the stage-wide grep at gate 3 entry (m) — `grep -rEn 'text-\[11px\]' stages/design/artifacts/` — will scan focus-ring-spec.html and see the remaining `text-[11px]` if unit-29 hasn't landed yet. The one-liner audit script (lines :80-85) has the same issue.

**Proposed fix (diff-level):**

Option A — add an explicit order dependency:

```yaml
# unit-31-contrast-and-type-scale-fixes.md
depends_on:
  - unit-29-focus-visible-canonicalization-and-spec-clarity
```

Option B — scope the stage-wide grep to exclude the one-line unit-29 handover:

```yaml
- >-
  Stage-wide grep gate: `grep -rEn 'text-\[11px\]' stages/design/artifacts/ |
  grep -v 'focus-ring-spec.html:108:'` — every surviving hit pairs with
  font-semibold/font-bold on the same element. The focus-ring-spec.html:108
  exclusion is audited by unit-29; this unit does not enforce it.
```

Pick A — the dependency makes the serial ordering explicit and removes the awkward grep exclusion.
