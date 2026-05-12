---
name: analyze
description: Analyze test results and compute quality metrics
hats: [analyst, statistician, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: execute-tests
    output: test-results
  - stage: plan
    discovery: test-strategy
---

# Analyze

Turn the test results into actionable quality insight. This stage produces the quality report — defect density, severity distribution, pass rates, defect-pattern clusters, root-cause categorization, trend analysis against historical baselines, and a release / defer / block recommendation. Descriptive numbers alone are not analysis; the value is in what the data means and what to do about it.

## Per-unit baton

Units in this stage are **analysis findings** — typically one slice per quality dimension, area, or trend question identified by the upstream strategy. Each unit walks the three hats in `plan → do → verify` order:

- **`analyst`** (plan / do for findings) reads the test results, surfaces patterns and root-cause hypotheses, recommends actions
- **`statistician`** (do for rigor) validates the metric math, checks sample-size sufficiency, applies trend / significance analysis where applicable
- **`verifier`** (verify) validates substance, citation, internal consistency, decision-register consistency

The baton is the unit body: pattern hypotheses → rigorously-validated findings → validated artifact.

## Inputs and outputs

The frontmatter declares the I/O contract. `execute-tests/test-results` and `plan/test-strategy` feed in; outputs (quality-report) feed `certify`.

## Fix loop and gate

`fix_hats: [classifier, analyst, feedback-assessor]` dispatches per finding. The classifier routes; `analyst` is the implementer (re-doing analysis where a finding is gap, citation, or rigor); the assessor decides closure. The gate is `ask` — a human reviews the analysis before it feeds into certification, because the release / defer / block recommendation is a judgment call. Project overlays at `.haiku/studios/quality-assurance/stages/analyze/` may add house conventions (organization-specific baseline datasets, named historical comparison periods, internal reporting templates) without modifying the plugin defaults.
