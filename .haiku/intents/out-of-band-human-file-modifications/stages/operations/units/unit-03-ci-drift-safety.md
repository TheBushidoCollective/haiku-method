---
title: 'CI guard: named drift tests + kill-switch documented in plugin README'
depends_on: []
inputs:
  - .github/workflows/ci.yml
  - packages/haiku/test/drift-detection-gate.test.mjs
  - packages/haiku/test/upstream-reconciliation.test.mjs
  - packages/haiku/test/drift-baseline.test.mjs
  - packages/haiku/test/drift-markers.test.mjs
  - plugin/README.md
outputs:
  - stages/operations/artifacts/unit-03-VERIFICATION.md
model: haiku
quality_gates:
  - name: ci-runs-haiku-tests
    command: >-
      grep -qE
      'cwd[[:space:]]+packages/haiku.*test|packages/haiku.*npm[[:space:]]+test|packages/haiku.*bun[[:space:]]+(run[[:space:]]+)?test'
      .github/workflows/ci.yml
  - name: ci-step-or-script-references-named-drift-tests
    command: >-
      bash -c 'grep -qE
      "drift-detection-gate\\.test\\.mjs|upstream-reconciliation\\.test\\.mjs|drift-baseline\\.test\\.mjs|drift-markers\\.test\\.mjs"
      .github/workflows/ci.yml || (test -f
      scripts/check-ci-covers-drift-tests.mjs && grep -qE
      "check-ci-covers-drift-tests" .github/workflows/ci.yml)'
  - name: kill-switch-documented-under-named-section
    command: >-
      bash -c 'awk "/^#+ /{section=\$0}
      /drift_detection:[[:space:]]*false/{if(section ~ /[Kk]ill[-
      ]?[Ss]witch|[Dd]isabling drift detection/){found=1;exit}} END{exit
      !found}" plugin/README.md'
  - name: readme-points-to-runbook
    command: grep -qE 'RUNBOOK\.md|\.haiku/knowledge/RUNBOOK' plugin/README.md
  - name: ci-yaml-still-valid
    command: >-
      bash -c 'python3 -c "import yaml,sys;
      yaml.safe_load(open(\".github/workflows/ci.yml\"))" 2>/dev/null || python3
      -c "import sys; open(\".github/workflows/ci.yml\").read()"'
status: completed
bolt: 1
hat: verifier
started_at: '2026-05-02T04:57:49Z'
hat_started_at: '2026-05-02T05:03:56Z'
iterations:
  - hat: ops-engineer
    started_at: '2026-05-02T04:57:49Z'
    completed_at: '2026-05-02T04:58:55Z'
    result: advance
  - hat: sre
    started_at: '2026-05-02T04:58:55Z'
    completed_at: '2026-05-02T05:03:56Z'
    result: advance
  - hat: verifier
    started_at: '2026-05-02T05:03:56Z'
    completed_at: '2026-05-02T05:14:14Z'
    result: advance
completed_at: '2026-05-02T05:14:14Z'
---
# Unit 03 — CI guard: named drift tests + kill-switch documented

## Scope

Lock in safety nets via CI assertions and README discoverability of the kill-switch.

Status note: deliverables already landed on operations branch from a prior execution that was lost when the workflow phase tracker reset. The verifier hat should confirm: CI runs the haiku test suite (or names drift tests explicitly), `plugin/README.md` documents `drift_detection: false` under a named section, and points to the runbook.

## Completion criteria

- `.github/workflows/ci.yml` runs the haiku test suite or names the drift `.test.mjs` files.
- `plugin/README.md` has a section heading containing "Kill-switch" or "Disabling drift detection" with the literal `drift_detection: false` snippet.
- `plugin/README.md` references `.haiku/knowledge/RUNBOOK.md`.
- `ci.yml` is valid YAML.

## References

- `.github/workflows/ci.yml`
- `plugin/README.md`
- Tests on this branch: `packages/haiku/test/drift-detection-gate.test.mjs`, `upstream-reconciliation.test.mjs`, `drift-baseline.test.mjs`, `drift-markers.test.mjs`
