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

The deliverable the customer pays for: a formal findings report with severity ratings, reproduction steps, remediation guidance, and an executive summary. This stage turns the assessment's technical work into something the customer can read, act on, and verify.

## Scope

Communicating findings for multiple audiences: per-finding descriptions, reproduction steps at the right detail, evidence references, severity per the engagement rubric, remediation guidance, and the executive summary, methodology, and scope sections that frame them. Reporting decides *how the findings are presented and remediated* — not what the findings are (the upstream assessment stages own that).

## What to do

- Write each finding for the audience that needs it — technical detail for engineers, business framing for executives.
- Make reproduction steps detailed enough to confirm the finding, without becoming a reusable attack script.
- Give remediation guidance with short-term mitigation, long-term fix, and a verification check the customer can run themselves.
- Tie every severity rating and claim to the evidence the assessment already captured.

## What NOT to do

- Don't introduce findings the assessment stages didn't establish — new findings are a revisit upstream, not a reporting invention.
- Don't restate severities that contradict the impact assessment without resolving the conflict.
- Don't ship a finding without its evidence trail or a remediation path.
- Don't leave the executive summary disconnected from the technical findings it summarizes.
