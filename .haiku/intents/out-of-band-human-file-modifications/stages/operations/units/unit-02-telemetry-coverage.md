---
title: Telemetry coverage for drift detection
depends_on: []
inputs:
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
  - packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts
  - packages/haiku/src/orchestrator/workflow/run-tick.ts
  - packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - packages/haiku/src/orchestrator/workflow/drift-markers.ts
  - packages/haiku/src/telemetry.ts
  - packages/haiku/test/telemetry-otel.test.mjs
  - deploy/operations/drift-detection-alerts.yaml
  - deploy/operations/drift-detection-slos.yaml
  - >-
    .haiku/intents/out-of-band-human-file-modifications/knowledge/IMPLEMENTATION-MAP.md
outputs:
  - deploy/operations/drift-detection-alerts.yaml
  - packages/haiku/test/telemetry-otel.test.mjs
  - .haiku/knowledge/RUNBOOK.md
model: sonnet
quality_gates:
  - name: latency-emitted-for-drift-gate
    command: grep -rqE 'haiku\.drift\.gate\.duration_ms' packages/haiku/src/
  - name: traffic-emitted-for-drift-gate
    command: grep -rqE 'haiku\.drift\.gate\.tick' packages/haiku/src/
  - name: errors-emitted-for-drift-gate
    command: >-
      grep -rqE
      'haiku\.drift\.baseline\.corrupt|haiku\.drift\.baseline\.write_failed'
      packages/haiku/src/
  - name: saturation-emitted-for-drift-gate
    command: >-
      grep -rqE 'haiku\.drift\.surface\.size|haiku\.drift\.findings\.count'
      packages/haiku/src/
  - name: saturation-emitted-for-marker-store
    command: >-
      grep -rqE 'haiku\.drift\.markers\.(open_count|total_count)'
      packages/haiku/src/
  - name: reconciliation-fingerprint-emit
    command: >-
      grep -rqE
      'haiku\.reconciliation\.fingerprint\.(established|matched|drifted|write_failed)'
      packages/haiku/src/
  - name: correlation-id-helper-defined
    command: >-
      grep -rqE 'function gateAttrs|const gateAttrs|gateAttrs\('
      packages/haiku/src/orchestrator/workflow/
  - name: pii-runtime-allowlist-or-denylist-in-emit
    command: >-
      grep -qE 'forbidden|deny|allowlist|denylist|sanitize|redact'
      packages/haiku/src/telemetry.ts
  - name: alerts-surface-correlation-labels
    command: >-
      bash -c 'set -e; FAIL=""; while IFS= read -r line; do match=$(echo "$line"
      | grep -oE "sum\\(rate\\(haiku\\.(drift|reconciliation)[^)]*\\)[^)]*\\)"
      || true); if [ -n "$match" ]; then if ! echo "$line" | grep -qE
      "by[[:space:]]*\\([^)]*intent_slug|by[[:space:]]*\\([^)]*stage|\\{\\{[[:space:]]*\\\$labels\\.intent_slug";
      then FAIL="$FAIL|$match"; fi; fi; done <
      deploy/operations/drift-detection-alerts.yaml; if [ -n "$FAIL" ]; then
      echo "alerts missing by(intent_slug,stage) or label annotation: $FAIL";
      exit 1; fi; exit 0'
  - name: telemetry-tests-pass
    command: >-
      bun run --cwd packages/haiku test -- --reporter=tap
      test/telemetry-otel.test.mjs
status: completed
bolt: 1
hat: verifier
started_at: '2026-05-02T04:57:18Z'
hat_started_at: '2026-05-02T05:07:38Z'
iterations:
  - hat: ops-engineer
    started_at: '2026-05-02T04:57:18Z'
    completed_at: '2026-05-02T05:02:03Z'
    result: advance
  - hat: sre
    started_at: '2026-05-02T05:02:03Z'
    completed_at: '2026-05-02T05:07:38Z'
    result: advance
  - hat: verifier
    started_at: '2026-05-02T05:07:38Z'
    completed_at: '2026-05-02T05:11:40Z'
    result: advance
completed_at: '2026-05-02T05:11:40Z'
---
# Unit 02 — Telemetry coverage for drift detection

## Scope

Add telemetry coverage for the drift-detection feature satisfying the four golden signals + correlation IDs + runtime PII deny-list, AND ensure the correlation IDs are surfaced through to alerts/SLO consumers (not just emitted into storage).

Status note: deliverables already landed on operations branch from a prior execution that was lost when the workflow phase tracker reset. The verifier hat should confirm the gates pass against the existing instrumentation in `drift-detection-gate.ts`, `upstream-reconciliation.ts`, `run-tick.ts`, the deny-list in `telemetry.ts`, and the alert/SLO files in `deploy/operations/`. If they do, no new work is needed.

## Cross-artifact contract: alerts MUST surface correlation labels

The `gateAttrs(ctx)` helper attaches `{intent_slug, stage, tick_iteration}` to every emit, so the labels exist in storage. But an alert that aggregates `sum(rate(haiku.drift.*))` without `by (intent_slug, stage)` collapses every intent into a single time series — when the alert fires, the operator can't tell which intent corrupted. Every alert rule whose underlying metric carries the correlation triple MUST either aggregate `by (intent_slug, stage)` or include `{{ $labels.intent_slug }}` (or `.stage`) in an annotation. The frontmatter gate `alerts-surface-correlation-labels` walks `deploy/operations/drift-detection-alerts.yaml` and rejects any `sum(rate(haiku.drift.* | haiku.reconciliation.*))` line that doesn't carry one of those.

## Completion criteria

- Correlation triple `{intent_slug, stage, tick_iteration}` on every emit via `gateAttrs(ctx)` helper.
- Latency: `haiku.drift.gate.duration_ms`, `haiku.reconciliation.fingerprint.duration_ms`.
- Traffic: `haiku.drift.gate.tick`, `haiku.reconciliation.fingerprint.matched`/`.drifted`/`.established`.
- Errors: `haiku.drift.baseline.corrupt`, `haiku.drift.baseline.write_failed`, `haiku.reconciliation.fingerprint.write_failed`.
- Saturation: `haiku.drift.surface.size`, `haiku.drift.findings.count`, `haiku.drift.markers.open_count`/`.total_count`, `haiku.reconciliation.corpus.bytes`, `haiku.drift.assessments.count`.
- Runtime PII deny-list in `telemetry.ts` rejects/strips `diff_unified`, `excerpt`, `file_content`, `user_email`, `user_name`, `message_body`, `finding_body`, `fb_body`, `content`.
- Test coverage in `packages/haiku/test/telemetry-otel.test.mjs`.
- **Alerts surface correlation labels** (see contract above).

## References

- `packages/haiku/src/telemetry.ts`
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts`
- `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts`
- `packages/haiku/src/orchestrator/workflow/run-tick.ts`
- `packages/haiku/src/orchestrator/workflow/drift-markers.ts`
- `deploy/operations/drift-detection-alerts.yaml`
- `deploy/operations/drift-detection-slos.yaml`
