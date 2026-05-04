---
title: Operational runbook for drift detection
depends_on: []
inputs:
  - .haiku/intents/out-of-band-human-file-modifications/knowledge/DISCOVERY.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/knowledge/DESIGN-DECISIONS.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/knowledge/IMPLEMENTATION-MAP.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/silent-filesystem-drop-detection.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/manual-change-assessment.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/agent-writes-on-behalf-of-human.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/explicit-spa-upload.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/drift-assessment-visibility.feature
  - deploy/operations/drift-detection-alerts.yaml
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
  - packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts
  - packages/haiku/src/orchestrator/workflow/run-tick.ts
  - packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - packages/haiku/src/orchestrator/workflow/drift-markers.ts
outputs:
  - .haiku/knowledge/RUNBOOK.md
model: sonnet
quality_gates:
  - name: runbook-exists
    command: test -f .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-kill-switch
    command: >-
      grep -qiE 'drift_detection:[[:space:]]*false|kill[- ]switch'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-baseline-corruption
    command: >-
      grep -qiE 'baseline.*(corrupt|repair)|haiku_repair'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-baseline-write-failure
    command: >-
      grep -qiE 'haiku\.drift\.baseline\.write_failed|baseline.write.fail'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-false-positive-flood
    command: >-
      grep -qiE 'false[- ]positive|silent.*establish'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-reconciliation
    command: >-
      grep -qiE 'haiku_reconciliation_acknowledge|reconciliation.*fingerprint'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-reconciliation-gate-scope
    command: >-
      grep -qiE 'reconciliation.*gate.*not.*kill[-
      ]switch|drift_detection.*only.*per.stage|reconciliation.*has no separate
      kill' .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-human-write
    command: >-
      grep -qiE 'haiku_human_write|human.attributed|on behalf of human'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-spa-upload
    command: >-
      grep -qiE 'spa.upload|/api/upload|knowledge upload|stage output
      replacement' .haiku/knowledge/RUNBOOK.md
  - name: runbook-covers-drift-visibility
    command: >-
      grep -qiE
      'drift.*(banner|panel|visibility|view)|assessment.*panel|drift.assessments'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-uses-per-stage-assessments-path
    command: >-
      grep -qE
      'stages/\{stage\}/drift-assessments|stages/[a-z-]+/drift-assessments'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-references-feature-files-with-absolute-path
    command: >-
      grep -qE
      '\.haiku/intents/out-of-band-human-file-modifications/features/[a-z-]+\.feature'
      .haiku/knowledge/RUNBOOK.md
  - name: runbook-has-symptom-and-remediation
    command: >-
      bash -c 'grep -qiE "symptom" .haiku/knowledge/RUNBOOK.md && grep -qiE
      "remediation" .haiku/knowledge/RUNBOOK.md'
  - name: runbook-anchors-resolve-from-alerts-yaml
    command: >-
      bash -c 'set -e; ANCHORS=$(grep -oE
      "runbook:[[:space:]]*[^[:space:]]+#[a-z0-9-]+"
      deploy/operations/drift-detection-alerts.yaml | sed -E "s/.*#//" | sort
      -u); MISSING=""; for a in $ANCHORS; do grep -qE "^#+ $(echo $a | tr - "[
      \.\-]" | sed -e "s/.*/[A-Za-z0-9 .-]*/")" .haiku/knowledge/RUNBOOK.md ||
      MISSING="$MISSING $a"; done; if [ -z "$ANCHORS" ]; then exit 0; fi;
      SLUG_OK=true; for a in $ANCHORS; do AS=$(echo $a | tr -d " ");
      HEADINGS=$(grep -E "^#+ " .haiku/knowledge/RUNBOOK.md | sed -E "s/^#+ +//;
      s/[^A-Za-z0-9 -]//g; s/  */ /g; s/ /-/g" | tr A-Z a-z | sort -u); if !
      echo "$HEADINGS" | grep -qx "$AS"; then SLUG_OK=false; echo "missing
      anchor: $a"; fi; done; $SLUG_OK'
status: completed
bolt: 1
hat: verifier
started_at: '2026-05-02T04:57:19Z'
hat_started_at: '2026-05-02T05:04:23Z'
iterations:
  - hat: ops-engineer
    started_at: '2026-05-02T04:57:19Z'
    completed_at: '2026-05-02T04:58:40Z'
    result: advance
  - hat: sre
    started_at: '2026-05-02T04:58:40Z'
    completed_at: '2026-05-02T05:04:23Z'
    result: advance
  - hat: verifier
    started_at: '2026-05-02T05:04:23Z'
    completed_at: '2026-05-02T05:11:51Z'
    result: advance
completed_at: '2026-05-02T05:11:51Z'
---
# Unit 01 — Operational runbook for drift detection

## Scope

Author `.haiku/knowledge/RUNBOOK.md` covering operational scenarios for the drift-detection feature. The runbook is what the user reaches for when something fires unexpectedly, when a baseline corrupts, when findings flood, when a human-attributed write goes wrong, when an SPA upload misroutes, when the drift visibility panel is confusing, or when the gate needs to be turned off fast.

This unit owns all five operational feature files at the intent root (`.haiku/intents/out-of-band-human-file-modifications/features/`). Each feature gets at least one runbook scenario.

## Status note

The deliverable already exists on this branch from a prior execution that was lost when the workflow phase tracker reset. The verifier hat should confirm the existing `.haiku/knowledge/RUNBOOK.md` already satisfies all the quality gates listed in this unit's frontmatter. If it does, no new work is needed.

## Cross-artifact contract: alerts ↔ runbook anchors

Every `runbook:` URL in `deploy/operations/drift-detection-alerts.yaml` MUST resolve to a heading anchor that exists in `.haiku/knowledge/RUNBOOK.md`. Alerts without working runbook links violate the observability mandate (operators page at 3am to a 404). The frontmatter gate `runbook-anchors-resolve-from-alerts-yaml` enforces this by extracting every `#anchor` from alerts.yaml and verifying it slug-matches a Markdown heading in RUNBOOK.md. If the verifier finds missing anchors, either add the named runbook section or update alerts.yaml to point at an existing one.

## Completion criteria

The runbook lives at `.haiku/knowledge/RUNBOOK.md` and covers, at minimum, these scenarios. Each scenario has **Symptom**, **Diagnostic**, **Remediation**, and **Escalation**. Every feature file at `.haiku/intents/out-of-band-human-file-modifications/features/` is referenced by at least one scenario.

1. False-positive finding flood after upgrade (silent-filesystem-drop-detection.feature migration path).
2. Kill-switch (per-stage drift detection disabled) — `drift_detection: false` in `.haiku/settings.yml`. Scope clause: only the per-stage drift gate; reconciliation gate uses `haiku_reconciliation_acknowledge` per stage.
3. Baseline corruption → `BaselineCorruptError` → `haiku_repair`.
4. Baseline write failure (`haiku.drift.baseline.write_failed` telemetry).
5. Reconciliation fingerprint mismatch.
6. Manual change assessment classification went wrong (manual-change-assessment.feature). Path: `.haiku/intents/{slug}/stages/{stage}/drift-assessments/`.
7. `haiku_human_write` misuse (agent-writes-on-behalf-of-human.feature).
8. SPA upload landed in the wrong place (explicit-spa-upload.feature).
9. Drift assessments panel shows stale/empty (drift-assessment-visibility.feature).
10. Pending-marker store leak.
11. Reconciliation gate fires on stage with stale fingerprint.

Plus any additional sections needed to satisfy the alert-anchor contract above (e.g. per-burn-rate scenarios that alerts.yaml routes to).

## References

- All five `.feature` files at intent root
- `deploy/operations/drift-detection-alerts.yaml` — alert→runbook anchor source
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts`
- `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts`
- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts`
- `packages/haiku/src/orchestrator/workflow/drift-markers.ts`
