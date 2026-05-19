---
name: certify
description: Quality sign-off and release readiness assessment
hats: [certifier, reviewer, verifier]
fix_hats: [classifier, certifier, feedback-assessor]
review: external
elaboration: autonomous
inputs:
  - stage: analyze
    discovery: quality-report
  - stage: execute-tests
    output: test-results
  - stage: plan
    discovery: test-strategy
---

# Certify

Sign off on quality and release readiness against the strategy's exit criteria. This stage produces the certification record — every exit criterion evaluated with evidence, every unresolved defect listed with risk-acceptance status, and the release / defer / block determination with rationale that audits cleanly.

## Per-unit baton

Units in this stage are **certification surfaces** — each surface evaluates a defined set of exit criteria (functional, performance, security smoke, accessibility, regression, compliance, etc.).

- `certifier` → `reviewer`: per-criterion evaluation with cited evidence + known-issues list with risk-acceptance status + release / defer / block determination with rationale.
- `reviewer` → `verifier`: independently-validated certification (release-readiness confirmed or findings filed against evidence / determination).

The baton is the certification surface: drafted determination → independently-validated determination ready for external sign-off.

## Inputs and outputs

The frontmatter declares the I/O contract. `analyze/quality-report`, `execute-tests/test-results`, and `plan/test-strategy` all feed in; outputs (certification-report) feed external sign-off and any downstream release / deployment flow.

## Fix loop and gate

`fix_hats: [classifier, certifier, feedback-assessor]` dispatches per finding. The classifier routes; `certifier` is the implementer (re-evaluating exit criteria, re-compiling known issues, sharpening rationale); the assessor decides closure. The gate is `external` — certification is the artifact a real authority signs (product owner, release manager, compliance lead, audit body). The plugin waits on the external signal; project overlays at `.haiku/studios/quality-assurance/stages/certify/` may add house conventions (organization sign-off ladder, internal audit-trail location, regulatory submission templates) without modifying the plugin defaults.
