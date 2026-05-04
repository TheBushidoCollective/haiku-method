---
title: haiku_classify_drift MCP tool (assessment recorder)
model: opus
depends_on:
  - unit-01-baseline-storage
  - unit-02-drift-markers-storage
  - unit-05-manual-change-assessment-handler
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
  - features/manual-change-assessment.feature
outputs:
  - packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts
  - packages/haiku/test/haiku-classify-drift.test.mjs
  - packages/haiku/src/orchestrator/workflow/drift-dispatch.ts
  - packages/haiku/src/orchestrator/workflow/run-tick.ts
  - packages/haiku/src/tools/orchestrator/index.ts
quality_gates:
  - name: biome
    command: >-
      bunx biome check
      packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b'
      packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts
status: completed
bolt: 1
hat: ''
started_at: '2026-04-30T21:45:41Z'
hat_started_at: '2026-04-30T21:45:41Z'
iterations:
  - hat: ''
    started_at: '2026-04-30T21:45:41Z'
    completed_at: '2026-04-30T22:05:53Z'
    result: advance
completed_at: '2026-04-30T22:05:53Z'
---
# haiku_classify_drift MCP tool (assessment recorder)

## Scope

Implement the agent-callable MCP tool that records classification outcomes from a `manual_change_assessment` action. This is the workflow's terminal step in the drift loop — it writes the durable `Assessment` record, optionally creates feedback items, dispatches revisits, and updates the baseline (or writes a pending marker) per the contract in DATA-CONTRACTS.md §4.3 and the baseline-update table in ARCHITECTURE.md §5.4 / AC-G4.

Deliverables per DATA-CONTRACTS.md §4.3:

1. **Zod input schema:**
   - `intent_slug` (required).
   - `tick_id` (required) — must match the active drift dispatch; stale tick IDs return `tick_id_stale`.
   - `classifications` (array of `Classification`, required) — one per finding; same length as the dispatched findings.
   - `agent_rationale` (string, required, ≥1 non-whitespace char).
   - `feedback_creates` (array of `FeedbackCreateInline`, conditional) — required when any classification is `surface-as-feedback` and `linked_feedback_id` is null. Each entry has `for_classification_path`, `title`, `body`, `origin: "agent"`, optional `resolution`.
2. **Validation pipeline (atomic — all-or-rollback):**
   - Validate `tick_id` against the active dispatch held in workflow state.
   - Validate `classifications.length === findings.length`.
   - Validate every `classifications[i].path` matches `findings[i].path`.
   - Validate every `outcome` is one of the four enum values; reject `auto-fix`, `escalate`, etc., with `illegal_outcome` (Scenarios "Agent attempts an invalid classification outcome alias").
   - Validate `outcome` is in the dispatched `legal_outcomes` for that path (rejects `inline-fix` on `file-removed`, `trigger-revisit` on current-stage findings).
   - Validate non-empty `rationale_excerpt` on every non-`ignore` outcome (Scenario "Agent omits rationale on a non-ignore outcome").
   - Validate `linked_feedback_id` is present (or has a matching `feedback_creates` entry) for every `surface-as-feedback`; otherwise `missing_link`.
   - Validate `linked_revisit_target_stage` is at-or-before the active stage for every `trigger-revisit`; otherwise `revisit_target_invalid`.
3. **Atomic side-effect ordering (DATA-CONTRACTS.md §4.3):**
   1. Write any `feedback_creates` entries via the existing `haiku_feedback` create path; capture the resulting `FB-NN` IDs.
   2. Resolve `linked_feedback_id` for any classifications that omitted it but provided an inline create.
   3. Build the `Assessment` record (DATA-CONTRACTS.md §2.3) with: `id` (`AS-NN` zero-padded next per intent), `created_at`, `tick_id`, `findings` (echoed from the dispatch), `classifications`, `agent_rationale`, `resulting_sha` (current on-disk SHA for terminal outcomes; `null` for non-terminal — never updated after this write), `revisit_invoked_at: null` (stamped later by the workflow engine when `haiku_revisit` fires), `mode`, `confirmed_by_user: false`.
   4. Write `Assessment` to `stages/{stage}/drift-assessments/DA-NN.json` (one record per assessment dispatch — append-only, never modified after writing).
   5. For each terminal classification (`ignore`, `inline-fix`): update `baseline.json` for the owning stage to `(currentSha, currentBytes, currentMtimeNs, isBinary)` with `author_class: "human-implicit"` (or carry the originating drift-event author class if the action log indicated `human-via-mcp`), `acknowledged_via: "classification-terminal"`. AC-CI2 — `ignore` on a deletion removes the baseline entry instead of updating it.
   6. For each non-terminal classification (`surface-as-feedback`, `trigger-revisit`): write a `PendingMarker` via `appendMarker` from unit-02 with `cleared_at: null`, `resolved_sha: null`, `baseline_sha_at_creation` set to the current on-disk SHA. Do NOT update `baseline.json`.
   7. For each `trigger-revisit`: dispatch `haiku_revisit` targeting `linked_revisit_target_stage`. The revisit dispatch handler stamps `Assessment.revisit_invoked_at` when revisit fires (downstream of this tool's return).
4. **Response shape (DATA-CONTRACTS.md §4.3):**
```
{
  ok: true,
  assessment_id,
  feedback_created: ["FB-NN", ...],
  pending_markers_created: <int>,
  baselines_updated: <int>,
  next_tick_will: <string describing immediate downstream effect>
}
```
5. **Rollback semantics:** if any step in the atomic pipeline fails after the feedback creates have landed, the tool MUST clean up partially-written state — no `Assessment` record left half-written, no markers without their feedback peers, no baseline updates without their assessment record. Use the existing transaction-style helpers in `state-tools.ts` for the cleanup.
6. **Emit `assessment_recorded` event (DATA-CONTRACTS.md §6.2):** after the atomic pipeline succeeds, emit the event with `outcomes_count`, `feedback_ids_created`, `baselines_updated`, `pending_markers_created`, `mode`. The orchestrator and telemetry are downstream consumers.
7. **Tool registration** in `packages/haiku/src/tools/orchestrator/index.ts`.

Tests in `test/haiku-classify-drift.test.mjs` cover every scenario in `features/manual-change-assessment.feature`:

- Each of the four canonical outcomes (`ignore`, `inline-fix`, `surface-as-feedback`, `trigger-revisit`) on a `modified` finding produces the expected side effects.
- `surface-as-feedback` writes the `Assessment` and the `PendingMarker` in the same atomic transaction; baseline is NOT updated; on next tick the gate suppresses re-detection (verified by chaining unit-04's gate against the resulting state).
- `trigger-revisit` writes the marker and dispatches `haiku_revisit`; baseline NOT updated; `Assessment.revisit_invoked_at` is `null` at write time and stamped when revisit fires (separate test exercises the post-tick stamping path).
- Outcome legality matrix: `(file-removed, inline-fix)` is rejected; all 11 other `(change_kind, outcome)` combinations succeed.
- Cross-stage drift: classification with `linked_revisit_target_stage` referring to an upstream stage triggers `haiku_revisit` targeting that stage.
- `ignore` does not re-fire on the next tick (chaining unit-04 against the post-classification baseline).
- Re-edited file after `ignore` fires a fresh assessment (the new SHA mismatches the new baseline).
- `agent_rationale` empty string is rejected with a non-empty-rationale error.
- `tick_id_stale` rejection.
- `classifications.length !== findings.length` rejection.
- Invalid outcome alias `auto-fix` rejected; `escalate` rejected.
- Same-tick large batch (60 findings) classified atomically; rollback on simulated failure leaves zero state changes.
- `Assessment` record durability: file written under `stages/{stage}/drift-assessments/DA-NN.json` survives a simulated branch switch (test fixture commits and switches branches).
- `assessment_recorded` event emitted with the correct payload counts.

## Completion Criteria

- `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts` exports the tool definition and handler.
- Tool registered in `index.ts`.
- Every scenario in `features/manual-change-assessment.feature` is covered by a passing test.
- Biome, `tsc --noEmit`, and `bun run --cwd packages/haiku test` pass.
- No placeholders.
