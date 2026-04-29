# Architecture-Prototype Sync Rule

The interactive runtime-architecture map lives at `/studios/<slug>/architecture` (e.g. `/studios/software/architecture`) — a real Next.js page rendered by `website/app/studios/[slug]/architecture/page.tsx` + the `ArchitectureMap` client component in the sibling `_components/` directory. The 2026-04-27 port replaced the old standalone `website/public/prototype-stage-flow.html` iframe with native React.

**Whenever the architecture changes, update this map.** It is part of the sync surface, not a one-off.

## Auto-generated workflow diagrams (per studio)

The per-studio Mermaid `stateDiagram-v2` files at `website/public/workflow-diagrams/<studio>.mmd` are derived from the workflow engine in `packages/haiku/src/orchestrator/workflow/` and the StudioConfig built from `plugin/studios/<studio>/`. They show every stage's full phase progression, every hat sequence enumerated inside `execute`, and every (bolt × fix-hat) combination inside `review_fix`.

**Regenerate after any studio change:**
```
bun run --cwd packages/haiku export:workflow-diagrams
```
(Also runs automatically as part of `bun run --cwd packages/haiku build` via the prebuild hook.)

These diagrams complement the hand-maintained architecture map — the map shows runtime actors / hooks / payloads in detail, the .mmd files show the structural state graph per studio. Update both together when an architecture change touches both surfaces.

## File layout

```
website/app/studios/[slug]/architecture/
  page.tsx                         # server component (chrome + breadcrumb)
  _components/
    ArchitectureMap.tsx            # main client component (state, layout, modals)
    Modal.tsx                      # generic modal shell + HtmlBlock helper
    utils.ts                       # renderInline, renderMarkdown, gateFromReview, etc.
    arch.css                       # ported CSS (was inline <style> in the legacy HTML)
  _data/
    types.ts                       # shared TS types
    actors.ts                      # ACTORS registry (5 runtime players)
    hooks.ts                       # HOOKS registry + hookFiresSelector()
    payload-for.ts                 # payloadFor(stage, idx, mStage, key, opts)
                                   # — every haiku_run_next transition including
                                   # the new feedback-dispatch route (2026-04-27)
website/public/prototype-stage-content.json   # bundled studio content (still used)
website/_build-prototype-content.mjs          # builds the JSON sidecar from plugin/studios/
```

## When to update

Any change to one of the following requires verifying or updating the architecture map:

| Change | What to update in the map |
|---|---|
| New / changed orchestrator action (e.g. new `haiku_run_next` return type) | Add or update the entry in `_data/payload-for.ts`; update validations/writes/instructions |
| New MCP tool added/removed | Update the orchestrator actor's `notes` in `_data/actors.ts`; if you add a tool-spec modal, register it in `ModalKind` (`_data/types.ts`) and `ArchitectureMap.tsx`'s `renderModal` switch |
| New / changed hook in `packages/haiku/src/hooks/` | Update `_data/hooks.ts` (`HOOKS` array: name, group, desc, fires tokens, file path) |
| New / removed stage in `plugin/studios/<studio>/stages/` | Rerun `node website/_build-prototype-content.mjs`; the JSON sidecar drives the diagram structure |
| New / removed hat / review-agent / discovery template / output template | Rerun `node website/_build-prototype-content.mjs` |
| Phase model change (new phase, removed phase, new transition) | Update the per-stage rendering inside `ArchitectureMap.tsx`'s `renderStage()` and add new pills/payloads as needed |
| Gate type change (`auto`, `ask`, `external`, `await`, combinations) | Update `effectiveGate()` (bottom of `ArchitectureMap.tsx`) and `gateFromReview()` in `utils.ts` |
| Mode behavior change (discrete/continuous/hybrid/auto) | Update `effectiveMode()` and `effectiveGate()` |
| New runtime actor (e.g. new MCP server, new background process) | Add to `_data/actors.ts` and to the `order` array in `renderActorsStrip()` inside `ArchitectureMap.tsx` |
| Pre-intent flow change | Update `renderPreIntentCard()` in `ArchitectureMap.tsx` |
| Post-intent change (delivery/ops steps, final gate semantics) | Update `renderPostIntentCard()` |
| New tick / pre-advance check / sideline action | Update the `tickSemantics` modal in `ModalRouter.tsx`; sync with `plugin/studios/ARCHITECTURE.md` §5 (canonical reference for tick contracts) |

## How to update

1. Edit the relevant file under `website/app/studios/[slug]/architecture/` (run `node website/_build-prototype-content.mjs` if the change is in `plugin/studios/`).
2. Visually verify in the dev server: `cd website && npm run dev`, then open `http://localhost:3000/studios/software/architecture`.
3. Make sure tooltips, click modals, hover-pairing, and inputs/outputs hover-pair into the knowledge pool sidebar all still match reality.
4. Type-check + build before merging: `cd website && npx tsc --noEmit && npm run build`.

## Ground truth

The map claims to be canonical. If it diverges from the orchestrator code, **the orchestrator is right and the map is wrong** — fix the map, do not fix the orchestrator to match.

## 2026-04-27 — `feedback_dispatch` route

The per-stage gate handler at `packages/haiku/src/orchestrator/workflow/handlers/gate.ts` no longer re-pops the review UI when a human-authored FB has `resolution: null`. It returns `feedback_dispatch` instead, handing the items back to the agent for inline triage / reply. The map reflects this in two places:

- `_data/payload-for.ts` has a `"feedback-dispatch"` transition entry.
- `_data/actors.ts` notes the pre-tick contract update on the orchestrator actor and the no-re-pop guarantee on the review web UI actor.
- `ArchitectureMap.tsx`'s `renderStage()` shows the post-2026-04-27 reject branch in the gate's nested-gate footer with a clickable `feedback_dispatch` payload pill.

## Known terminology drift (followup work)

The AI-DLC paper (`website/content/papers/ai-dlc-2026.md`) and several docs (`docs/concepts.md`, `docs/workflows.md`, `docs/example-*.md`) reference an **operating-mode taxonomy: HITL / OHOTL / AHOTL** that the implementation has moved past. Today the only mode field is `intent.mode` (`continuous` / `discrete` / `hybrid`); user involvement is determined by per-stage `gate` type in `STAGE.md` plus which skill the user invoked (`/haiku:start`, `/haiku:pickup`, `/haiku:autopilot`, `/haiku:revisit`).

The prototype reflects the **implementation**, not the legacy paper terminology. When the paper/docs are revised to align with the implementation, this note can be removed and the prototype's User-actor modal "terminology drift" callout can also be removed.

## Churn-reduction v2 (2026-04-19) — Feedback-as-unit fix loop + intent-completion review

- **Stage `fix_hats`** — `STAGE.md` now declares `fix_hats:` as an ordered subset (or superset) of hats. When adversarial review produces open feedback, the workflow engine dispatches the fix-hat sequence directly against the feedback file. New orchestrator actions: `review_fix` (per-finding dispatch, serial, 3-bolt cap per finding). Fix-mode hats may live outside the main `hats:` rotation (e.g. a `feedback-assessor` hat that runs only in fix loops).
- **Stage feedback-assessor hat** — every stage that opts into `fix_hats` now ships `hats/feedback-assessor.md` as a terminal validator that independently decides closure. Not part of the execute rotation.
- **Studio-level review + fix** — new directories `plugin/studios/{studio}/review-agents/` and `plugin/studios/{studio}/fix-hats/` (NOT per-stage). Fires once, after the final stage's gate passes, when `intent.intent_completion_review === true`. New orchestrator actions: `intent_completion_review` (studio-wide agent dispatch), `intent_completion_fix` (studio-level fix loop). Findings are written at intent scope (`.haiku/intents/{slug}/feedback/FB-NN.md`).

## Pre-tick triage gate (2026-04-27) — replaces upstream-routing model

- **`triaged_at:` on feedback frontmatter** — agent-authored FBs (origins: `agent`, `adversarial-review`, `studio-review`, etc.) auto-stamp `triaged_at:` at creation. Human origins (`user-chat`, `user-visual`, etc.) leave it null.
- **Pre-tick gate** in `runWorkflowTick` (between tamper detection and per-state dispatch) walks every stage from index 0 through the current stage plus intent-scope, collecting open FBs. Three priority outcomes:
  1. Any untriaged FB → emit `feedback_triage` action listing each item; agent classifies via `haiku_feedback_move` (no-op confirm) or `haiku_feedback_reject` (dismiss).
  2. All triaged + ≥ 1 on a stage earlier than active → `revisit()` is invoked targeting the earliest such stage, returning the existing `revisited` action.
  3. All triaged + open FBs only on current stage → null, falls through to existing handlers.
- **`haiku_feedback_move`** new MCP tool. Same-stage call stamps `triaged_at:`. Cross-stage call relocates the file to the target stage's `feedback/` dir, renumbers to next free FB-NN, moves any sidecar attachment, and rewrites the body's `/api/feedback-attachment/...` URL. Pre-flight collision check refuses to overwrite existing destination attachments.
- **No `upstream_stage:` field, no `upstream_finding_surfaced` action** — both deleted. Cross-stage routing flows through file location, not a frontmatter hint.

These are NOT yet wired into the per-stage visualizations in `prototype-stage-flow.html` beyond the header banner. When adding them:
- The stage-loop template should show a new branch at gate: pending feedback + `fix_hats` set → `review_fix` dispatch, not `feedback_revisit`.
- The `payloadFor(...)` registry needs entries for the new action types.
- The post-intent card should show the optional studio-level review layer between "all stages approved" and `intent_complete`.

## Recently closed gaps (track for related follow-up)

- **Discovery fan-out via subagents** (closed 2026-04-14) — the orchestrator now injects a `## Discovery Fan-Out (REQUIRED)` section into the elaborate-phase `tool_use_result`, instructing the agent to spawn one `Task` subagent per declared `discovery/*.md` template (research + production). Per-studio hat md files do not carry this instruction; it's workflow-level so it applies uniformly across studios. Affected file: `packages/haiku/src/orchestrator.ts` (elaborate case, after `discoveryFiles` loop). Prototype reflects this in step ② of Elaborate ("the workflow engine fans out one ↗ subagent per artifact") and in the `elab-to-gate` injection list.
- **MCP tool list correction** (closed 2026-04-14) — Orchestrator actor modal now lists the real 27 tools across `orchestrator.ts`, `state-tools.ts`, and `server.ts`, grouped by category (workflow drivers · state tools · review-server). Removed the previously-invented tool names.
- **Hat progression mechanism** (closed 2026-04-14) — `hat-to-hat` payload now correctly reflects that the **subagent** calls `haiku_unit_advance_hat` (success) or `haiku_unit_reject_hat` (failure), and the orchestrator internally progresses the workflow engine in the same call. Not a `haiku_run_next` tick. The action in the modal is now `haiku_unit_advance_hat`.
- **Missing tools `haiku_select_studio` and `haiku_intent_reset`** (closed 2026-04-14) — added to `TOOL_SPECS` with full input/output/writes. `haiku_select_studio` is now referenced as a clickable pill in the studio-detection step of the intent creation card. `haiku_unit_start`, `haiku_unit_advance_hat`, `haiku_unit_reject_hat` also added.
- **`ask_user_visual_question`** (closed 2026-04-14) — added to `TOOL_SPECS` and referenced as a clickable pill in the elaborate ① conversation step, noting the agent uses it for structured visual decisions instead of inline chat options.
- **Wave-spawn atomicity** (closed 2026-04-14) — each Execute wave now shows a small purple dashed callout above the cylinder row: *"↗ parent spawns N subagents in one response · no menu, no per-unit confirmation"*, citing `orchestrator.ts:2509`.

## Ground truth (reiterated)

The prototype claims to be canonical. When implementation changes, update the prototype using this rule's tables. When the prototype is wrong, fix the prototype, not the orchestrator.
