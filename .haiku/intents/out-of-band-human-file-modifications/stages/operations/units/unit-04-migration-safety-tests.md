---
title: Migration safety tests + kill-switch round-trip + write_failed sentinel
depends_on: []
inputs:
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
  - packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts
  - packages/haiku/src/orchestrator/workflow/run-tick.ts
  - packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - packages/haiku/test/drift-detection-gate.test.mjs
  - packages/haiku/test/upstream-reconciliation.test.mjs
outputs:
  - .github/workflows/ci.yml
  - scripts/check-migration-safety-markers.mjs
model: sonnet
quality_gates:
  - name: scenario-A-silent-establish-test-named
    command: >-
      grep -qiE 'silently auto.add|silently establish|previously.unseen
      file|baseline.auto.add' packages/haiku/test/drift-detection-gate.test.mjs
  - name: scenario-B-next-tick-fires-on-real-change
    command: >-
      grep -qE 'auto-added file fires.*modified.*on the NEXT tick|next-tick
      change|fires.*modified.*on the next tick'
      packages/haiku/test/drift-detection-gate.test.mjs
  - name: scenario-D-reconciliation-silent-establish
    command: >-
      grep -qE 'first elaboration with priors silently establishes
      fingerprint|silently establish.*fingerprint|null fingerprint.*silently
      establish' packages/haiku/test/upstream-reconciliation.test.mjs
  - name: scenario-E-fingerprint-match-skips
    command: >-
      grep -qE 'stored fingerprint matches current corpus|matching fingerprint
      must short-circuit|fingerprint.*matches.*skip'
      packages/haiku/test/upstream-reconciliation.test.mjs
  - name: scenario-F-fingerprint-drift-fires
    command: >-
      grep -qE 'stored fingerprint differs from current
      corpus|fingerprint.*differs.*fires'
      packages/haiku/test/upstream-reconciliation.test.mjs
  - name: drift-tests-pass
    command: bun run packages/haiku/test/drift-detection-gate.test.mjs
  - name: reconciliation-tests-pass
    command: bun run packages/haiku/test/upstream-reconciliation.test.mjs
  - name: haiku-suite-passes
    command: bun run --cwd packages/haiku test
status: completed
bolt: 1
hat: verifier
started_at: '2026-05-02T04:57:14Z'
hat_started_at: '2026-05-02T05:09:41Z'
iterations:
  - hat: ops-engineer
    started_at: '2026-05-02T04:57:14Z'
    completed_at: '2026-05-02T04:59:37Z'
    result: advance
  - hat: sre
    started_at: '2026-05-02T04:59:37Z'
    completed_at: '2026-05-02T05:09:41Z'
    result: advance
  - hat: verifier
    started_at: '2026-05-02T05:09:41Z'
    completed_at: '2026-05-02T05:11:58Z'
    result: advance
completed_at: '2026-05-02T05:11:58Z'
---
# Unit 04 — Migration safety tests

## Scope

Test-enforce the migration-safety contract for the drift gate (per-file SHA) and the reconciliation gate (corpus fingerprint): only previously-recorded values that change become findings.

Status note: deliverables (test files with scenarios A-G) already landed on operations branch from a prior execution that was lost when the workflow phase tracker reset. The verifier hat should confirm the test files contain the named scenarios and the suite passes.

## Required scenarios

- A: silent auto-baseline of previously-unseen file
- B: auto-added file fires `modified` on next tick
- C: baseline.json absent → first-tick establish-mode
- D: first elaboration with priors silently establishes fingerprint
- E: stored fingerprint matches current corpus → gate skips
- F: stored fingerprint differs → gate fires
- G: `haiku_reconciliation_acknowledge` records decision and unblocks subsequent ticks

## Completion criteria

- All scenarios have corresponding `await test(...)` blocks in `drift-detection-gate.test.mjs` or `upstream-reconciliation.test.mjs`.
- Both test files exit 0 individually.
- Full `bun run --cwd packages/haiku test` passes.

## References

- Implementations: `drift-detection-gate.ts`, `upstream-reconciliation.ts`, `run-tick.ts`
