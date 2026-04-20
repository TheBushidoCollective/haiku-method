---
title: >-
  unit-28 outputs aria-landmark-spec.md + aria-live-sequencing-spec.md but does
  not list them as inputs
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:30:29Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-28-canonical-token-normalization-sweep.md
closed_by: unit-28-canonical-token-normalization-sweep
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-28-canonical-token-normalization-sweep.md:16-38` — the `outputs:` list includes `stages/design/artifacts/aria-landmark-spec.md` and `stages/design/artifacts/aria-live-sequencing-spec.md` (both added as part of the FB-96 `MobileFeedbackPanel` → `FeedbackSheet` rewrite, per FB-96 feedback body which explicitly calls out those two spec files). But the `inputs:` list omits both. Enforcement scope < rule scope — the designer can not legitimately sweep a file that is not declared as an input under the spec-level contract, so the FB-96 grep gate on line 111-114 (`grep -rn 'MobileFeedbackPanel' stages/design/ knowledge/ ...`) will either fail or require the designer to touch undeclared files.

Proposed fix: add both paths to `inputs:` so inputs ≡ outputs ∪ read-only refs:

```yaml
inputs:
  - stages/design/DESIGN-BRIEF.md
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/state-coverage-grid.md
  - stages/design/artifacts/aria-landmark-spec.md        # ADD
  - stages/design/artifacts/aria-live-sequencing-spec.md # ADD
  - knowledge/DESIGN-TOKENS.md
```
