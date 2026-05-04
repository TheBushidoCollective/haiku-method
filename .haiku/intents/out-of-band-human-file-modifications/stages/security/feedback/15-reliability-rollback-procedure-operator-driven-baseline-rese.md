---
title: >-
  Reliability: rollback procedure (operator-driven baseline-reset) is not tested
  end-to-end before stage closure
status: closed
origin: adversarial-review
author: reliability (from operations)
author_type: agent
created_at: '2026-05-03T11:03:58Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'deferred-to-followup-iteration:v-11-rollback-e2e-test'
bolt: 0
triaged_at: '2026-05-03T11:03:58Z'
resolution: stage_revisit
replies: []
---

## Finding

The security stage's V-11 mitigation (unit-03) introduces a rollback / recovery procedure for baseline corruption:

1. Drift-detection gate detects `baseline_corrupt` and refuses silent re-establish.
2. Operator runs `/haiku:repair --confirm-baseline-reset --diff-shown`.
3. `reconstructPriorBaseline(intentDir, stage)` rebuilds the last-known-good baseline from `baseline-content/` + `action-log.jsonl`.
4. Operator reviews reconstructed-vs-on-disk diff and confirms the specific diff hash.
5. Workflow engine writes `.baseline-ack` marker; next tick consumes the marker (single-use), establishes baseline, drift gate passes.

ASSESSMENTS.md V-11 row claims this rollback procedure is "closed" (`exit_code=0` for both gates). But the gates only verify:

- `v11-baseline-corrupt-operator-ack-required` — grep for `baseline_corrupt_acknowledged|requireOperatorAck|reconstructPriorBaseline` in `drift-baseline.ts` (a string-presence check, not a behavioral test).
- `v11-no-silent-auto-establish-after-corrupt` — negative grep on `drift-detection-gate.ts` (also a string-presence check).

The unit tests at `packages/haiku/test/unit-03-security.test.mjs:476-546` cover `reconstructPriorBaseline` in isolation:
- V-11.R1: returns null when no sidecars exist.
- V-11.R2: returns null when sidecars exist but no action log.
- V-11.R3: rebuilds from valid sidecar + action log.
- V-11.R4: rejects sidecar with mismatched hash.

None of these tests exercise the **full rollback procedure** end-to-end:
- corrupt baseline.json → run a workflow tick → observe `baseline_corrupt` action with thrash metadata
- run the operator command (`/haiku:repair --confirm-baseline-reset --diff-shown`) → observe diff-prompt
- operator confirms diff hash → `.baseline-ack` written
- run the next workflow tick → observe baseline established from reconstructed content
- subsequent tick → drift gate passes, no thrash

The rollback procedure has unit-tested components but the integrated workflow has no test that proves it actually works as documented. This is a "tested in pieces, untested as a procedure" gap — the kind that fails the first time an operator reaches for it under incident pressure.

## Mandate spirit

The reliability mandate says "verify that rollback procedure is **defined and tested**." A rollback procedure split across MCP tool, CLI command, drift gate, baseline-reconstruction logic, and operator-confirmation marker — with each piece unit-tested but no end-to-end test — does not meet "tested." The integration gaps between those pieces are exactly where production rollback procedures fail.

## Why this is in scope for the security stage

The security stage is the owner of V-11 and its rollback procedure; the procedure exists specifically because the security stage decided silent re-establish was an attacker primitive and required operator intervention instead. The stage is responsible for proving the alternative (operator-driven rollback) actually works as a procedure.

## Recommended fix

Add an end-to-end integration test (`packages/haiku/test/v11-rollback-procedure.test.mjs`) that:

1. Sets up a fresh intent + stage with established baseline + several action-log entries.
2. Corrupts `baseline.json` (e.g., truncate to 0 bytes, write garbage).
3. Calls `runWorkflowTick()` and asserts the result is the `baseline_corrupt` error with the operator-instruction message.
4. Asserts `recordBaselineCorruption` recorded the event (tick counter incremented, recent-corrupt-count = 1).
5. Calls `reconstructPriorBaseline(intentDir, stage)` and asserts the returned baseline matches the pre-corruption state (or, if any tracked file changed on-disk between baseline and now, asserts the diff is non-empty and the hash matches the expected reconstruction).
6. Writes a `.baseline-ack` marker with the matching diff hash via the operator-only path (not the agent's MCP tools — the test should fail if `haiku_human_write` deny-list lets it through).
7. Calls `runWorkflowTick()` again and asserts the result is `baseline_established`, the `.baseline-ack` marker is consumed, and the next tick passes drift cleanly.
8. Repeat the corrupt-then-restore cycle 4 times within 10 ticks; assert the 4th iteration emits `haiku.security.baseline_thrash` and refuses recovery even with a valid ack marker (operator must use `--override-thrash-circuit-breaker`).

Add the test to the `quality_gates:` of the next security iteration (this stage if iteration is open, or a new `unit-05-rollback-procedure-test` if security has closed).

## Severity

**Medium** — reliability of the documented rollback procedure. Today: the procedure is "documented + scaffolded + per-piece unit-tested" but not "tested as a procedure." Severity escalates if any piece changes (e.g., the marker format, the reconstruction algorithm, the gate's recovery branch) without the integration test catching the break.

## Files affected

- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md` (V-11 row's claim that rollback is "closed")
- `packages/haiku/test/unit-03-security.test.mjs:476-546` (per-piece tests)
- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` (`reconstructPriorBaseline`, `readBaselineAckMarker`, `clearBaselineAckMarker`)
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:440-557` (the gate's recovery branch)
- (missing) `packages/haiku/test/v11-rollback-procedure.test.mjs`
