---
name: reporting
description: Formal findings report with severity ratings, reproduction steps, remediation guidance, and executive summary
hats: [report-writer, remediation-advisor, verifier]
fix_hats: [classifier, report-writer, feedback-assessor]
review: external
elaboration: autonomous
inputs:
  - stage: post-exploitation
    discovery: impact-assessment
outputs:
  - discovery: findings-report
    hat: report-writer
---

# Reporting

Formal findings report with severity ratings, reproduction steps, remediation guidance, and executive summary. The deliverable the customer pays for. Units are **report sections** (one per finding or finding-cluster) plus the executive summary, methodology, and scope sections that wrap them.

## Per-unit baton

The three hats execute in `plan → do → verify` order:

- **`report-writer`** (plan/do): drafts the section — finding description, affected asset, reproduction steps at the right level of detail, evidence references, severity per the engagement rubric, multi-audience language.
- **`remediation-advisor`** (do): adds the remediation guidance — short-term mitigation, long-term fix, verification check the customer can run themselves to confirm the fix worked.
- **`verifier`** (verify): validates the section's evidence trail, severity alignment, reproduction-step appropriateness, and remediation specificity. Body-only per architecture §3.4.

The baton: impact assessment → drafted section → remediation-augmented section → validated section.

## Inputs and outputs

Consumes `post-exploitation/impact-assessment`. Produces `FINDINGS-REPORT.md` (intent-scope) plus per-unit remediation entries.

## Fix loop and gate

`fix_hats: [classifier, report-writer, feedback-assessor]` — most findings are clarity, evidence-completeness, or remediation-specificity issues; `report-writer` is the implementer. Gate is `external` because the report is the engagement deliverable — sign-off lives in the customer's review channel (their ticketing system, doc platform, or signed PDF), not in a local approval.
