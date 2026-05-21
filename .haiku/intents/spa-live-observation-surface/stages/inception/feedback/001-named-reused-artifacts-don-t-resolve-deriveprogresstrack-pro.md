---
title: >-
  Named reused artifacts don't resolve: deriveProgressTrack / progress-track.ts
  / session schema path
status: pending
origin: adversarial-review
author: cross-stage-consistency
author_type: agent
created_at: '2026-05-21T03:57:33Z'
iteration: 0
visit: 0
source_ref: 'cross-stage-consistency:review'
closed_by: null
bolt: 0
triaged_at: '2026-05-21T03:57:33Z'
resolution: null
replies: []
targets:
  unit: unit-002-technical-landscape-and-constraints
  invalidates:
    - cross-stage-consistency
---

The unit-002 spec instructs the artifact to name three pre-existing capabilities it "reuses as-is." Two of those names do not resolve against the actual tracked codebase, and a third has the wrong path. Because inception is the first stage, the "upstream reality" this spec must align with is the existing repo it anchors to — and the specific names diverge from it. Cheap to fix now (text in a unit spec); expensive once design/development build on a name that doesn't exist.

Concrete divergences (verified with `git grep` / `git ls-files`, excluding `.haiku/`):

1. **`deriveProgressTrack` does not exist.** The spec (and `intent.md`) say "`deriveProgressTrack` already computes the ordered phase track and is already consumed by the statusline." `git grep deriveProgressTrack` returns zero matches in tracked code. No symbol by that name is defined or exported anywhere in `packages/`.

2. **`progress-track.ts` does not exist.** `intent.md` cites "sourcing `deriveProgressTrack` from progress-track.ts." `git ls-files | grep progress-track` returns nothing. No such file is tracked.

3. **The SPA Zod wire schema path is wrong.** The spec says the wire payload "is validated by the project's one Zod schema (in the `haiku-api` session schema)" and `intent.md` cites `packages/haiku-api/src/session.ts`. The actual file is `packages/haiku-api/src/schemas/session.ts` (note the `schemas/` segment). `packages/haiku-api/src/session.ts` does not exist. The Zod-validated session schema and `IntentCurrentState` live in `packages/haiku-api/src/schemas/session.ts`; the server-side state builder the spec wants to populate is `packages/haiku/src/http/session-api.ts` (that path is correct) and `packages/haiku/src/current-state.ts` (getCurrentState).

Why this matters per the mandate (reference consistency + naming consistency): unit-002's whole job is to hand design an accurate map of what already exists so design doesn't re-derive it. If design inherits "reuse `deriveProgressTrack` from `progress-track.ts`" verbatim, it will plan against a symbol/file that isn't there, and the divergence surfaces as wasted rework at execute time.

Suggested correction (no new scope — this is a naming fix): before sealing inception, reconcile the milestone/phase-track reference to the symbol and file that actually produce the statusline's granular track in the tracked tree (the named `deriveProgressTrack` / `progress-track.ts` could not be located — the spec author should pin the real exported name and path, e.g. via the haiku:haiku-statusline skill's actual track producer), and fix the Zod schema citation to `packages/haiku-api/src/schemas/session.ts`. If the design brief's intent was that `deriveProgressTrack`/`progress-track.ts` are to be *created* by this feature rather than reused, then unit-002 should state that explicitly instead of describing it as an existing capability "reused as-is" — that contradiction (new vs reused) is the core drift.
