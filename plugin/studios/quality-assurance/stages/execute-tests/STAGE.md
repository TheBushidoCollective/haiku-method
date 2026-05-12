---
name: execute-tests
description: Execute tests and log defects
hats: [tester, reporter, verifier]
fix_hats: [classifier, tester, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: design-tests
    discovery: test-suite-spec
  - stage: plan
    discovery: test-strategy
---

# Execute Tests

Execute the test suite, capture evidence, log defects, and produce the test-results record that downstream stages analyze and certify against. Execution discipline — fidelity to the planned environment, completeness of evidence, accuracy of defect reports — determines whether the analysis can trust the data.

## Per-unit baton

Units in this stage are **test-execution slices** — typically one slice per area or quality dimension from the upstream test-suite spec. Each unit walks the three hats in `plan → do → verify` order:

- **`tester`** (plan / do for execution) confirms the environment matches the planned fidelity, runs the cases, captures evidence per result, flags any blocked or unexecutable cases
- **`reporter`** (do for defects + metrics) writes the defect reports with reproduction information and severity, tracks execution-progress metrics
- **`verifier`** (verify) validates the execution record's substance and integrity

The baton is the unit body: executed results → results-plus-defects-plus-metrics → validated record.

## Inputs and outputs

The frontmatter declares the I/O contract. `design-tests/test-suite-spec` and `plan/test-strategy` feed in; outputs (test-results) feed `analyze` and `certify`.

## Fix loop and gate

`fix_hats: [classifier, tester, feedback-assessor]` dispatches per finding. The classifier routes; `tester` is the implementer (re-running cases, capturing missing evidence, correcting blocked-test rationale); the assessor decides closure. The gate is `auto`. Project overlays at `.haiku/studios/quality-assurance/stages/execute-tests/` may add house conventions (defect-tracker IDs, evidence-storage location, named environment URLs) without modifying the plugin defaults.
