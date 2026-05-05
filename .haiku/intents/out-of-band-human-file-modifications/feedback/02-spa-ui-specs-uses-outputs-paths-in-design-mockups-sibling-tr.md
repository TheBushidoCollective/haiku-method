---
title: >-
  SPA-UI-SPECS uses `outputs/` paths in design mockups; sibling
  TRACKED-SURFACE-BOUNDARY locks `artifacts/` as canonical
status: closed
origin: studio-review
author: cross-stage-consistency
author_type: agent
created_at: '2026-05-03T21:54:37Z'
iteration: 0
visit: 0
source_ref: null
closed_by: 'fix-loop:FB-02:bolt-1'
bolt: 1
triaged_at: '2026-05-03T21:54:37Z'
resolution: null
replies: []
hat: validator
iterations:
  - bolt: 1
    hat: reconciler
    completed_at: '2026-05-03T21:56:58Z'
    result: advanced
  - bolt: 1
    hat: validator
    completed_at: '2026-05-03T21:57:56Z'
    result: closed
---
## Finding

Two design-stage artifacts disagree on the canonical name of the stage output directory shown to users in the SPA.

## The conflict

- **`stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md`** §0 ("Canonical Directory Name") explicitly locks the canonical name:

  > "`artifacts/` is the canonical name for a stage's output directory. The DESIGN-BRIEF.md and earlier sketches in this intent sometimes reference `outputs/` as a hypothetical output area; for the purposes of this spec and all downstream units, **`artifacts/` is the canonical name**. Wherever prior documents use `outputs/`, the implementation maps to `artifacts/`. The alias is noted explicitly: **`stages/{stage}/outputs/` is an alias for `stages/{stage}/artifacts/`** — do not create a separate `outputs/` directory; treat both references as pointing to `artifacts/`."

- **`stages/design/artifacts/SPA-UI-SPECS.md`** §3.4 line 320 — visible in a literal UI mockup the SPA is supposed to render — still shows the path as `outputs/`:

  > ```
  > [▾ See N files]
  >
  >   stages/design/outputs/hero.html    modified 4m ago
  >   knowledge/brand-guide.pdf          added 12m ago
  >   stages/inception/notes.md          modified 18m ago
  > ```

The SPA mockup teaches the user that the path the system displays is `stages/design/outputs/...`. But the implementation (per TRACKED-SURFACE-BOUNDARY) writes and stores at `stages/design/artifacts/...` and the alias is one-way (`outputs/` → `artifacts/`, never the reverse). A user clicking through to the path shown in the SPA would land on a non-existent directory.

## Why this is a cross-stage finding (in spirit)

The two design artifacts are sibling specifications — both are normative inputs to development. The product stage's `unit-01-acceptance-criteria.md` reconciliation gap §4 (and similar in `unit-02-behavioral-specs.md`) explicitly called out the `outputs/`/`artifacts/` alias as a reconciliation-required item. The SPA-UI-SPECS missed the reconciliation in its own user-facing mockups, so the alias is documented in design contracts but not carried into design's UI specs. Cross-document consistency within the design stage's own artifacts is part of the stages-deliver-the-stated-goal mandate.

## Suggested resolution

Rewrite the SPA-UI-SPECS line 320 mockup to use `stages/design/artifacts/hero.html` so users see the canonical name. If the design is intentionally surfacing the `outputs/` alias as a friendly user-visible name, document the rationale at line 320 inline so a downstream developer doesn't "fix" it the wrong way.

## File:line refs

- `.haiku/intents/out-of-band-human-file-modifications/stages/design/artifacts/SPA-UI-SPECS.md:320` (mockup uses `outputs/`)
- `.haiku/intents/out-of-band-human-file-modifications/stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md:18-20` (canonical-name lock)
- `.haiku/intents/out-of-band-human-file-modifications/stages/product/units/unit-01-acceptance-criteria.md` (reconciliation gap §4)
- `.haiku/intents/out-of-band-human-file-modifications/stages/product/units/unit-02-behavioral-specs.md` (reconciliation gap §4)
