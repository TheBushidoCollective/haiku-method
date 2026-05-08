---
title: 'Missed criterion: unit-01 artifact has no Competitive differentiation section'
origin: adversarial-review
author: spec-conformance
author_type: agent
created_at: '2026-05-05T23:10:10Z'
source_ref: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: researcher
    completed_at: '2026-05-05T23:12:35Z'
    result: advance
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-05-05T23:13:37Z'
    result: closed
targets:
  unit: null
  invalidates: []
closed_at: 'fix-loop:FB-01:bolt-1'
---
## Spec criterion violated

unit-01-success-criteria-and-acceptance-shape's completion criteria explicitly require:

> A `## Competitive differentiation` section naming at least four competitors (from: GitHub Copilot Workspace, Devin, Sweep, Cursor, OpenHands) with one paragraph per competitor describing what each does and does NOT do with respect to: session bundle as diagnostic artifact, fire-and-forget UX, autonomous-until-green fix loop. End with a one-paragraph differentiation claim that downstream product/design must preserve.

This is also one of the three lenses unit-01's `Topic` calls out as load-bearing for the inception stage: "the competitive differentiation lives in the same artifact because it's the same lens".

## What the artifact actually contains

`.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md` has these top-level sections:

- `## Fire-and-forget UX contract`
- `## Acceptance shape — what "done" looks like`
- `## Bounded loops — caps and escape hatches`
- `## Open Questions`
- `## Citations`

There is no `## Competitive differentiation` section. Competitor analysis is referenced once in the Citations list pointing to DISCOVERY.md, but the artifact itself does not name the competitors, does not describe what each does and does not do across the three lenses (session-bundle-as-diagnostic, fire-and-forget UX, autonomous-until-green), and does not produce the one-paragraph differentiation claim that downstream stages are supposed to inherit.

## Why this is intent-level, not per-unit

Per-unit verification (the verifier hat) marked unit-01 complete. The cross-unit / intent-level lens is: the inception stage's job is to hand downstream stages a sharpened spec that preserves the differentiator. None of the other inception artifacts (unit-02 capability map, unit-03 surfaces, unit-04 privacy, unit-05 risks, unit-06 open questions) carry the competitor analysis either — DISCOVERY.md has the prose discussion but it was supposed to be sharpened into the inception artifact, and that did not happen. The intent's success criteria (bullet 1: "the issue appears attributed to the user, with a linked bot-authored PR, without any additional manual steps") is preserved across the artifacts, but the *differentiation* against Devin / Sweep / Copilot Workspace / Cursor / OpenHands — which is what protects the design from quietly converging on one of them — is not.

## File reference

`.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md` — section is absent (the file ends at the Citations block on line 111).
