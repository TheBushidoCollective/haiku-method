---
title: Technical landscape and hard constraints
description: >-
  Catalog the existing systems this feature builds on at capability level, and
  the non-negotiable constraints the design session already settled, so design
  starts from facts not rediscovery.
model: sonnet
outputs:
  - stages/inception/artifacts/technical-landscape.md
iterations: []
reviews:
  spec:
    at: '2026-05-21T03:55:14.425Z'
    body_sha256: 580cc50d54722f21a4c817595c39bac2a8d6a10ba92d364f0ca8b0a7d4fd5f66
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
  continuity:
    at: '2026-05-21T03:55:28.687Z'
    body_sha256: 580cc50d54722f21a4c817595c39bac2a8d6a10ba92d364f0ca8b0a7d4fd5f66
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
approvals: {}
---
## Topic

Name the existing capabilities this feature reuses and the constraints already settled in the design session — at the landscape level, so the design stage inherits the map instead of re-deriving it. This is awareness, not a design spec: name *that* a capability exists, not *how* to wire it.

## What the artifact must cover

- The existing live-update channel: the review SPA already maintains a per-session WebSocket/heartbeat that reuses an open browser tab and routes intent events. State plainly that the feature reuses this channel — **no new transport is introduced**.
- The milestone source of truth: `deriveProgressTrack` already computes the ordered phase track and is already consumed by the statusline. The feature reuses it as-is rather than reimplementing the milestone math in the SPA.
- The wire-schema boundary: the SPA wire payload is validated by the project's one Zod schema (in the `haiku-api` session schema) — distinct from the TypeBox used everywhere else. New wire fields extend the Zod schema.
- The capability needs the feature introduces, each named with at least one viable supplier in principle (not a specific library): a client-side ticking timer, key-stable React list reconciliation, a toast/notification primitive, and a "new output landed" live trigger.
- The two hard constraints settled in the design session, stated as constraints design must honor: (a) the milestone derivation must not be invoked from the current-state builder due to import-cycle risk — it is populated at the session-API layer, the same pattern the statusline took; (b) reconcile-in-place (stable keys, no remount, preserve scroll / expansion / selection / in-flight feedback) is the load-bearing requirement that separates "observe" from "annoying auto-refresh".

## Completion criteria

- Every named capability need lists at least one viable supplier in principle (e.g. "client-side timer — satisfiable with browser timers, no server round-trip"), with no claim that a capability is achievable that has no supplier.
- The two hard constraints (import-cycle guard, reconcile-in-place) are each stated as a top-level constraint with a one-sentence "why", not buried in a sub-clause.
- The "no new transport" decision is stated explicitly and attributed to the design session.
- The artifact stays at capability/landscape level: it names *that* `deriveProgressTrack`, the session channel, and the Zod schema exist and are reused — it does NOT specify new function signatures, field names, request/response shapes, or which call site changes. Those are design-stage outputs.
