---
title: manual_change_assessment action handler + action union
model: sonnet
depends_on:
  - unit-04-pre-tick-drift-gate
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
  - features/manual-change-assessment.feature
outputs:
  - >-
    packages/haiku/src/orchestrator/workflow/handlers/manual-change-assessment.ts
  - packages/haiku/src/orchestrator/actions.ts
  - packages/haiku/test/manual-change-assessment-handler.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku/src/orchestrator/workflow/handlers/manual-change-assessment.ts
      packages/haiku/src/orchestrator/actions.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/orchestrator/workflow/handlers/manual-change-assessment.ts
status: completed
bolt: 1
hat: ''
started_at: '2026-04-30T20:38:18Z'
hat_started_at: '2026-04-30T20:38:18Z'
iterations:
  - hat: ''
    started_at: '2026-04-30T20:38:18Z'
    completed_at: '2026-04-30T21:37:34Z'
    result: advance
completed_at: '2026-04-30T21:37:34Z'
---
# manual_change_assessment action handler + action union

## Scope

Add `manual_change_assessment` to the workflow action discriminated union and implement the handler that builds the action payload the agent receives in response to a tick where the drift gate emitted findings.

Deliverables:

1. **Action union update (`actions.ts`):** extend the discriminated union with `manual_change_assessment` per ARCHITECTURE.md §2.3 and DATA-CONTRACTS.md §3.2. Add a guard helper `isManualChangeAssessment(action)` for downstream consumers.
2. **Payload shape (DATA-CONTRACTS.md §3.2):** the action payload carries `action: 'manual_change_assessment'`, `intent_slug`, `stage` (active), `tick_id`, `findings: DriftFinding[]`, `mode` (intent operating mode), `instructions` (orchestrator-built string), and `legal_outcomes` (map from finding path → array of legal classification outcomes).
3. **`buildManualChangeAssessmentAction(ctx, findings)`** in `handlers/manual-change-assessment.ts`:
   - Assigns each finding a stable `finding_id` (`DRF-NN`, zero-padded, scoped to the dispatch).
   - Builds the `legal_outcomes` map per AC-CO1 (current-stage findings exclude `trigger-revisit`) and per the change_kind matrix in DATA-CONTRACTS.md §3.4 (`file-removed` excludes `inline-fix`).
   - Builds a `tick_id` carrying `(intent_slug, tickCounter, ISO timestamp)` so the classify tool can validate freshness (rejects stale tick IDs).
   - Builds the `instructions` prose: tell the agent to call `haiku_classify_drift`, list the four outcomes, name each finding's allowed outcomes, and remind the agent to populate `agent_rationale` and per-finding `rationale_excerpt` (AC-EE5 — empty rationale on non-ignore is rejected).
   - Returns the fully-typed action object ready for the agent's `tool_use_result`.
4. **Tick handoff:** `run-tick.ts` (modified by unit-04) calls this builder when the drift gate returns findings, then short-circuits per-state dispatch and emits the action.
5. **Architecture-prototype sync update:** add `'manual_change_assessment'` to `website/app/studios/[slug]/architecture/_data/payload-for.ts` and add the new transition arrow on the orchestrator actor's notes in `_data/actors.ts`. The architecture-prototype-sync rule (`/Users/jwaldrip/.../.claude/rules/architecture-prototype-sync.md`) requires this update whenever a workflow action is added.
6. **Mermaid diagrams:** running `bun run --cwd packages/haiku export:workflow-diagrams` regenerates `website/public/workflow-diagrams/*.mmd` so the drift gate appears for every studio. Verify post-regeneration that no studio's diagram is broken.

Tests in `test/manual-change-assessment-handler.test.mjs` cover the scenarios in `features/manual-change-assessment.feature`:

- Builder produces an action with `action === 'manual_change_assessment'`.
- `findings` array length equals input length; ordering preserved.
- `legal_outcomes` excludes `trigger-revisit` for current-stage findings (AC-CO1) and includes all four for earlier-stage findings (AC-EO1).
- `legal_outcomes` excludes `inline-fix` for `file-removed` change_kind (DATA-CONTRACTS.md §3.4 / AC matrix).
- `tick_id` is unique per dispatch — two consecutive tick dispatches return different IDs.
- `instructions` mentions `haiku_classify_drift` and the four outcome strings.
- Same-tick atomic batching: 60 findings produce one action with all 60 in the `findings` array (Scenario "Large drift batch is dispatched in a single atomic action payload").
- Discriminated-union update is reflected in `isManualChangeAssessment` guard (returns true for the new shape, false for any other action).

## Completion Criteria

- `packages/haiku/src/orchestrator/actions.ts` registers the new action variant and guard.
- `packages/haiku/src/orchestrator/workflow/handlers/manual-change-assessment.ts` exports `buildManualChangeAssessmentAction`.
- All tests in `test/manual-change-assessment-handler.test.mjs` pass under `bun run --cwd packages/haiku test`.
- The architecture-prototype map is updated (`_data/payload-for.ts`, `_data/actors.ts`) per the sync rule; the website still builds (`bun run --cwd website build` is verified by the website-build gate at intent completion, not here, but a basic `cd website && npx tsc --noEmit` should pass).
- Biome + tsc pass.
- No placeholders.
