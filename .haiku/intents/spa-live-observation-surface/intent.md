---
title: SPA live observation surface
studio: ''
status: active
created_at: '2026-05-21T03:42:26.000Z'
draft_pr_url: 'https://github.com/gigsmart/haiku-method/pull/373'
draft_pr_status: draft
---

# SPA live observation surface

Turn the review SPA from a static point-in-time snapshot into a live observation surface — leave it open and watch the workflow advance in real time without losing your place. Five pieces: (1) mirror the statusline's granular phase track in the SPA stepper (elaborate → each review role → execute → each approval role → observations) with a coarse-phase fallback, sourcing `deriveProgressTrack` from progress-track.ts rather than reimplementing the milestone math; (2) show each in-progress unit's current hat on the unit card; (3) per-unit total durations that tick client-side for in-progress units; (4) the big ask — refresh SPA data on tick/hat-advance over the existing session channel, reconciling state IN PLACE (stable keys, no remount, preserve scroll/expansion/selection — the view must never jump); (5) toasts on observed change that deep-link to new assets. Plus make `/haiku:show` and `haiku_review_open` fully non-blocking — passive observe surface, "Done" is a pure client-side close, feedback still rides the next tick. Hard constraints: no new transport (reuse the existing session WebSocket/poll + heartbeat), wire new fields through session-api.ts not getCurrentState (import-cycle risk), extend the Zod wire schema in packages/haiku-api/src/session.ts. Distinct from the haiku_view runtime-verifier work — different surface.

Source: /Users/jwaldrip/Downloads/spa-live-observation-design.md (recovered from session cefcf3e6, 2026-05-20). Key decisions baked into the brief: deriveProgressTrack (progress-track.ts) is the source of truth and must NOT be called from getCurrentState (import cycle) — populate wire fields in session-api.ts instead, same pattern the statusline took. IntentCurrentState gains milestones[]+index/total, per-unit currentHat, per-unit duration/startedAt. SPA wire schema is Zod in packages/haiku-api/src/session.ts (the one place the project uses Zod, not TypeBox). Render target is ReviewPage PhaseStepper in haiku-ui. Live-update channel is the existing session/heartbeat that reuses an open tab — NOT a new socket. In-place reconciliation (no UI jump) is the load-bearing requirement that separates "observe" from "annoying auto-refresh." Live triggers: unit/writer-hat advances, and ticks where new outputs are detected on disk. Keep coarse-phase fallback for intents without a resolvable granular track.
