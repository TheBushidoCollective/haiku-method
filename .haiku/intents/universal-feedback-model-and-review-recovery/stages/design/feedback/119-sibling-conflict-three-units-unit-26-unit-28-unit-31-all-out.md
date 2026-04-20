---
title: >-
  Sibling conflict — three units (unit-26, unit-28, unit-31) all output
  contrast-and-type-audit.md
status: open
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:31:05Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-26-artifact-opacity-ban-enforcement.md
closed_by: null
bolt: 0
upstream_stage: null
---

`contrast-and-type-audit.md` is declared as an output by three independent units with no `depends_on` wiring:

- `stages/design/units/unit-26-artifact-opacity-ban-enforcement.md:26` — adds `§N.bolt-5` audit table row recording five closed divergences (FB-92/94/95/97/102) and rewrites PASS rows per quality gate 7 (line 110-118).
- `stages/design/units/unit-28-canonical-token-normalization-sweep.md:30` — modifies lines 255-256 (Re-open → Reopen) per quality gate 4 (line 72).
- `stages/design/units/unit-31-contrast-and-type-scale-fixes.md:26` — rewrites §3 Type Scale verification section to embed the `text-[11px]` one-liner audit script, updates per-artifact rows post-fix, per quality gate 4 (line 87-92).

All three land in parallel bolts. Whichever writes last silently clobbers the others. Additionally all three add/touch audit rows describing the SAME artifacts (e.g. `revisit-unit-list.html`, `assessor-summary-card.html`) — without coordination the audit will contain three mutually-inconsistent row sets after fan-out.

Proposed fix: serialize with explicit deps so audit edits compose:

```yaml
# unit-28 depends_on: [unit-26]
# unit-31 depends_on: [unit-28, unit-26]
```

Or designate one unit (e.g. unit-31, because its §3 rewrite touches the most of the audit) as the sole audit editor and strip `contrast-and-type-audit.md` from unit-26 and unit-28 outputs, moving those updates into unit-31's scope. Recommend the `depends_on` chain — preserves per-unit semantic scope and keeps FB closure traceable.
