# Discovery — SPA Live Observation Surface

## Business Context

### Feature Goal and Vision

The review SPA is currently a point-in-time snapshot: a human opens the URL, sees what the engine had committed when the session was created, and waits for the next tick or manual page refresh to see new state. For short intents that's tolerable. For long-running development stages with 10-20 units executing in parallel, it's a blind window — a reviewer watching a design stage complete can't see individual units advance, can't tell which hat is in progress, can't see how long a unit has been running, and gets zero notification when new outputs land without manually refreshing.

The goal is to turn the SPA from a passive form into a live observation surface. A reviewer leaves the tab open and watches the workflow advance in real time — unit cards update their hat status, a phase stepper tracks granular progress (the same detail the statusline shows), per-unit durations tick client-side, new outputs trigger toasts with deep links, and all of this happens without the view jumping or losing the reviewer's scroll position, open cards, or text they're typing.

There are also two behavioral goals for `haiku_review_open` and `/haiku:show`: they should be fully non-blocking from the agent's perspective. Today the SPA's "Done" button resolves the gate; after this work, "Done" is a pure client-side tab close and the agent never waits on it.

### Origin and Context

The brief originated in a design session on 2026-05-20 and was recovered from session `cefcf3e6` (source file: `/Users/jwaldrip/Downloads/spa-live-observation-design.md`). Several key implementation constraints were settled in that session and are baked into the intent brief:

- `deriveProgressTrack` (in `packages/haiku/src/orchestrator/workflow/progress-track.ts`) is the source of truth for milestone computation and must not be called from `getCurrentState` due to import-cycle risk — it must be called from `session-api.ts` instead, following the same pattern the statusline uses.
- The SPA wire schema for new fields must live in `packages/haiku-api/src/session.ts` (the Zod schema, not TypeBox — this is the one place in the project that uses Zod).
- The live-update channel is the existing session WebSocket/heartbeat; no new transport is introduced.
- In-place state reconciliation (no UI jump, stable keys, preserve scroll/expansion/selection) is the load-bearing requirement separating "observe" from "annoying auto-refresh."
- Live triggers are hat-advance events and ticks where new outputs are detected on disk.

### Success Criteria

- A reviewer can leave the SPA open during a multi-unit development stage and watch unit cards update their current hat label without refreshing.
- The phase stepper shows granular per-milestone pips (one per review/approval role and per hat) rather than the coarse five-phase strip, matching the statusline's level of detail.
- Each in-progress unit card shows a live-ticking duration with no manual refresh.
- When a new output artifact lands on disk during the reviewer's session, a toast appears with a deep-link to the artifact — the reviewer doesn't need to know to scroll down.
- The view never jumps: scroll position, expanded units, selected stages, and in-flight feedback text are all preserved across live updates.
- `haiku_review_open` and `/haiku:show` return immediately; the agent does not wait for the tab to be closed.

## Competitive Landscape

### Who Offers Something Similar

Developer-facing live-workflow UIs exist across several tools:

- **GitHub Actions / GitLab CI live log streaming** — the CI run page refreshes step-level status in real time via WebSocket or SSE. Users watch jobs flip from queued to running to passed without reloading. Logs stream line-by-line. GitHub's implementation is well-regarded for stability of the page layout while streaming.

- **Linear** — issue boards update in real time as teammates move cards. Cursor presence is shown. The update model is WebSocket-based with optimistic local state. Linear is a reference for how to do in-place list reconciliation without losing selection or scroll.

- **Vercel's deployment dashboard** — a deployment transitions through build → edge-network → live with per-step durations ticking in the browser. New outputs (preview URL, size report) appear as toasts with links. Their toast UX is widely cited as a benchmark for non-intrusive but visible state notifications.

- **Railway / Render live logs** — streaming log output with a "jump to bottom" affordance that disappears when the user scrolls up. The affordance model (stream is live by default; user scroll pauses it; a button resumes) is relevant to how the SPA might handle the "don't interrupt what I'm reading" contract.

### What They Do Well

GitHub Actions nails the stability contract: layout doesn't jump as steps complete. Linear nails the reconciliation model: list items update in place, selections are preserved, mutations from other users don't surprise you. Vercel nails toasts: non-intrusive, informative, auto-dismiss, deep-linked.

### Gaps and Opportunities

None of these tools solve the specific problem of a human review form that also needs to remain interactive (feedback composer, approve button) while state streams in around it. Vercel's deployment page doesn't accept user input — it's read-only. Linear's boards don't have gated approval flows. The H·AI·K·U SPA needs both: live observation AND an interactive review surface in the same view without either interfering with the other. That's the distinct design challenge.

## Considerations and Risks

### Strategic Considerations

This feature is internal infrastructure for H·AI·K·U users. The risk of getting the reconciliation wrong is high UX cost: a view that jumps or loses state will be disabled by users faster than it was enabled. The "no new transport" constraint de-risks the server side significantly — the existing WS infrastructure is already battle-tested.

The non-blocking `haiku_review_open` change is a behavioral contract change. Any agent prompt or skill that currently assumes `haiku_review_open` blocks until the reviewer closes the tab will need updating when this ships. That's a sync-check concern (see open questions).

### Capability Needs

- Needs client-side timer capability (trivially satisfied via `Date.now()` + `setInterval` in the SPA; no server involvement).
- Needs a key-stable list reconciliation strategy in React (satisfied via stable unit slug keys; no new library required).
- Needs a toast / notification primitive in the SPA's component library (currently absent — design stage will decide between a lightweight inline toast or a third-party library).
- Needs a mechanism to detect "new output landed on disk" as a live-trigger (server side — the intent broadcaster already has `tick_committed` events; the question is whether per-output events are added or if a tick-level refetch is sufficient).

### Open Questions

1. **Reconciliation granularity**: should the SPA refetch the full session payload on each `tick_committed` intent event, or should the server push diffs? The brief implies refetch (reuse existing `/api/session/:id` GET), but at high tick rates this may be expensive. Design stage should evaluate.
2. **Toast deduplication**: if two outputs land in the same tick, do two toasts fire? Is there a batch-toast mode? Design needs to decide.
3. **Non-blocking `haiku_review_open` behavior change**: the current `haiku_review_open` tool docs say the agent waits for the session to end. If that description is wrong after this change (the session becomes TTL-driven and the agent doesn't wait), the tool description in `state-tools.ts` and any downstream prompt that references blocking behavior needs updating. Design stage should enumerate the affected surfaces.
4. **Scroll preservation during update**: when a live update arrives and the unit list changes order (e.g., a unit completes and would sort differently), does the list re-sort or does it freeze order during the session? Preserving sort order for session duration avoids jumps; dynamic sort risks scroll surprise.
5. **Import cycle guard**: `deriveProgressTrack` must not be called from `getCurrentState` — the brief names this explicitly. Design must specify which call site populates `milestones` on the wire response and ensure the import graph stays clean.

### Risks

- **State divergence between WS push and REST pull**: if the WS delivers a unit-changed event but the subsequent GET to `/api/session/:id` is cached (or the server's drift cache has a stale TTL), the SPA could briefly show inconsistent state. The existing 2s drift-cache TTL in `session-api.ts` is the known stale window.
- **Reviewer feedback lost on update**: if an in-flight feedback form submission races with a live update that triggers a re-render, the composer could lose its draft. Careful state isolation (feedback state lives in a ref or context unaffected by session payload updates) is required.
- **Branch overlap with `out-of-band-human-file-modifications`**: that intent is actively modifying `packages/haiku-ui/src/pages/review/ReviewPage.tsx`, `packages/haiku-api/src/schemas/session.ts`, and `packages/haiku/src/http/session-api.ts` — all three of which this intent will also touch. Merge-order matters; coordinate or plan to merge that intent first. See Existing Code Structure below.

## UI Impact

### Affected Surfaces

- **Review SPA — phase stepper (StageBanner → PhaseStepper)**: currently renders either granular milestones (when `session.current_state.milestones` is set) or the coarse five-phase fallback. The live-update work wires `milestones` into the update cycle so the stepper advances pip-by-pip as the engine progresses.
- **Review SPA — unit cards (UnitsTable / StageReview units tab)**: unit cards currently show status derived from frontmatter at session-load time. After this work they show a live-updating current-hat label and a ticking duration for in-progress units.
- **Review SPA — output artifacts area**: new outputs that arrive after session load trigger toasts with deep-links into the outputs tab. The artifacts panel itself gets a new-output animation or highlight affordance.
- **Review SPA — live session channel (useSessionWebSocket hook)**: the hook already handles `intent-event` messages of type `tick_committed`, `unit_changed`, etc. The live-update feature teaches the hook's consumer (the review page route) to refetch session state on these events and reconcile in place.
- **`haiku_review_open` / `/haiku:show`**: behavioral change — these become fully non-blocking. The agent receives the URL and the tool call returns; the session lives until TTL expiry. The SPA's "Done" button becomes a pure `window.close()`.

## Existing Code Structure

### Transport Layer

- `packages/haiku-ui/src/hooks/useSessionWebSocket.ts` (active) — manages the WS connection per session, routes `session-update` and `intent-event` frames. Already has `onIntentEvent` callback; the live-update feature wires a new consumer. The `tick_committed` event type in `intent-broadcaster.ts` is the primary trigger for session refetch.
- `packages/haiku/src/intent-broadcaster.ts` (active) — per-intent pub/sub. Defines `IntentEvent` discriminated union including `tick_committed`, `unit_changed`, `feedback_changed`, `gate_prepared`, `await_state_changed`, `pending_decision_changed`. Live triggers for this feature will originate here.
- `packages/haiku/src/http/ws.ts` (active) — WebSocket registry; `sendToWebSocket` pushes frames; `broadcastIntent` fans out per-intent events to all connected SPA tabs.

### Session API and Wire Schema

- `packages/haiku-api/src/session.ts` (active) — Zod wire schema for all session types. `IntentCurrentStateSchema` already includes `milestones` (`ProgressMilestoneSchema[]`) and `progress_index`. `ReviewSessionPayloadSchema` carries `drift`, `stage_states`, `current_state`, `unit_outputs`, etc. New fields for `currentHat` and `startedAt`/duration on per-unit state will extend this schema. This is the only place in the project that uses Zod (not TypeBox).
- `packages/haiku/src/http/session-api.ts` (active) — `respondSessionApi` builds the session payload. Already calls `deriveProgressTrack` and populates `milestones`/`progress_index` on `current_state`. New per-unit hat/duration fields must be populated here (same pattern, same call site). **Do not call `deriveProgressTrack` from `getCurrentState` — import cycle.**
- `packages/haiku/src/current-state.ts` (active) — `getCurrentState` returns `IntentCurrentState`. Currently does not call `deriveProgressTrack` (intentionally; see session-api.ts). Must remain clean.

### Progress Track

- `packages/haiku/src/orchestrator/workflow/progress-track.ts` (active) — `deriveProgressTrack` enumerates ordered milestones for stage or intent scope. Called by the statusline (`statusline/state.ts`) and by `session-api.ts`. The intent is to reuse this as-is, not reimplement the math in the SPA or in `current-state.ts`.

### Review SPA — Page Shell

- `packages/haiku-ui/src/pages/review/ReviewPage.tsx` (active) — top-level review shell. Contains `PhaseStepper`, `StageBanner`, and the main layout. `PhaseStepper` already has the granular-milestones rendering path (when `milestones` is non-empty) and the coarse-five-phase fallback. The live-update work feeds new milestone data into this component on each session refresh. **Note: `out-of-band-human-file-modifications` is actively modifying this file on `origin/haiku/out-of-band-human-file-modifications/main`.**
- `packages/haiku-ui/src/pages/review/stage/StageReview.tsx` (active) — per-stage content renderer. Units, knowledge, outputs. Unit card rows show status and expand to body. Currently reads status from the session payload at mount; live update will require reconciling unit frontmatter changes in place.
- `packages/haiku-ui/src/pages/review/shared/UnitsTable.tsx` (active) — tabular unit listing. `deriveUnitStatus` computes displayed status from FM. The live-update work must either update the session payload in place (triggering a re-derive) or add a `currentHat` prop alongside.

### Review Routes

- `packages/haiku-ui/src/routes/review/$sessionId/route.tsx` (active) — TanStack Router review route. Owns the top-level `useSessionWebSocket` call and is the entry point for live-update logic. **Also modified by `out-of-band-human-file-modifications`.**

### Tool Call Handlers

- `packages/haiku/src/server/tool-call.ts` (active) — handles `haiku_review_open`. Currently the ad-hoc path creates a session, launches a browser, and returns the URL immediately (lines ~424–535). The non-blocking contract is already partially in place for ad-hoc sessions (the tool does not await the session's close). The design stage must confirm whether any remaining blocking path exists and close it.
- `packages/haiku/src/state-tools.ts` (active) — `haiku_review_open` tool definition and description. The description may reference blocking behavior; needs audit in design.

### Potential Conflict Surface

- `packages/haiku-ui/src/pages/review/ReviewPage.tsx` (in-flight) — `origin/haiku/out-of-band-human-file-modifications/main`
- `packages/haiku-api/src/schemas/session.ts` (in-flight) — `origin/haiku/out-of-band-human-file-modifications/main`
- `packages/haiku/src/http/session-api.ts` (in-flight) — `origin/haiku/out-of-band-human-file-modifications/main`
- `packages/haiku/src/sessions.ts` (in-flight) — `origin/haiku/cascading-model-selection/main`, `origin/haiku/cowork-mcp-apps-integration/main`
