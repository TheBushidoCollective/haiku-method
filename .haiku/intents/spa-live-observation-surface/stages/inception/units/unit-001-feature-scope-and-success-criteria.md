---
title: Feature scope and success criteria
description: >-
  Distill the problem statement, origin, in/out-of-scope boundaries, and
  user-observable success criteria for turning the review SPA into a live
  observation surface.
model: sonnet
outputs:
  - stages/inception/artifacts/feature-scope.md
iterations: []
reviews:
  spec:
    at: '2026-05-21T03:55:14.424Z'
    body_sha256: 7c70a8d5c365cba0bb5c11cd1c243a4370074ee0d7ed15b04064cf46b15ceaba
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
  continuity:
    at: '2026-05-21T03:55:28.687Z'
    body_sha256: 7c70a8d5c365cba0bb5c11cd1c243a4370074ee0d7ed15b04064cf46b15ceaba
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
approvals: {}
---
## Topic

Capture *what* this feature is and *why* it exists, at the problem-space level — no implementation. The reader is the design stage, which must understand the desired user-observable behavior before proposing an approach.

## What the artifact must cover

- The core reframe: the SPA moves from a point-in-time snapshot (open, read, close, manual refresh) to a live observation surface a reviewer leaves open and watches advance. Name the concrete pain it removes (the "blind window" during long multi-unit stages).
- The five observable capabilities the feature delivers, each stated as reviewer-observable behavior: (1) granular phase track matching the statusline's detail, (2) current-hat label per in-progress unit, (3) per-unit duration that ticks live, (4) in-place live updates that never jump the view, (5) toasts on change that deep-link to new assets.
- The behavioral contract change: `/haiku:show` and `haiku_review_open` become fully non-blocking — "Done" is a pure client-side close, the agent never waits, feedback still rides the next tick.
- Explicit non-goals / scope boundary: this is the *review SPA becoming live*. It is distinct from the `haiku_view` runtime-verifier (boot-the-app-and-drive-it-with-Playwright) work — different surface, different intent. Name that boundary so design doesn't conflate them.
- Origin: the 2026-05-20 design session, recovered from session `cefcf3e6`, source brief `/Users/jwaldrip/Downloads/spa-live-observation-design.md`.

## Completion criteria

- Success criteria section lists ≥5 criteria, each phrased in user-observable terms (e.g. "a reviewer watches unit cards update their hat label without refreshing"), NOT in implementation terms ("the WS pushes a diff"). Each must be observably distinguishable from "not done".
- Scope section names ≥1 explicit non-goal (at minimum the `haiku_view` runtime-verifier boundary) with a one-sentence differentiation.
- Origin is cited with the specific session id and source brief path — not "a recent session".
- The artifact contains no entity field names, API shapes, file-internal module boundaries, or framework choices — those are design-stage concerns. A reviewer reading only this artifact understands the *what/why*, not the *how*.
