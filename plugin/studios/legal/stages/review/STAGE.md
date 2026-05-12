---
name: review
description: Conduct legal review and compliance check
hats: [reviewer, compliance-officer, verifier]
fix_hats: [classifier, reviewer, feedback-assessor]
review: external
elaboration: autonomous
inputs:
  - stage: draft
    output: draft-document
  - stage: research
    discovery: research-memo
  - stage: intake
    discovery: legal-brief
outputs:
  - discovery: review-findings
    hat: reviewer
---

# Review

Substantive review of the draft against the brief, the research memo, and applicable compliance requirements. Review is a validation-class stage: each unit corresponds to one review surface — a specific clause family, a regulatory regime, a risk category, or a counterparty markup. The output is a `REVIEW-FINDINGS.md` per unit that the execute stage and the licensed attorney use to close gaps before execution.

Review surfaces issues; review does NOT certify legal sufficiency. Findings classified `critical` mean "the licensed attorney should look here first," not "this is legally defective." The attorney is always the final arbiter of legal judgment.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`reviewer`** (plan / do for legal lens) — reads the draft against the brief and memo, identifies provisions that create unintended exposure or fail to address an identified risk, and categorizes findings by severity
- **`compliance-officer`** (do for compliance lens) — maps the draft against the applicable regulatory regimes identified in research, flags compliance gaps, and notes specific provisions that need attention
- **`verifier`** (verify) — confirms findings are specific, severity-tagged, and traceable to a source (a clause + a brief or memo reference)

## Inputs and outputs

Review consumes the upstream draft, memo, and brief. It produces `REVIEW-FINDINGS.md` per unit at intent scope. Findings feed `execute` (where the closer hat incorporates the resolved items into the final document).

## Fix loop and gate

`fix_hats: [classifier, reviewer, feedback-assessor]` dispatches per finding. Classifier routes; reviewer re-authors the finding with additional specificity (or escalates back to draft via cross-stage feedback if a clause needs rewriting); assessor closes. The gate is `external` — the workflow waits for the licensed attorney's external sign-off (in whichever review channel the firm uses) before advancing to `execute`. Approval is detected by branch merge or external-system signal; the agent does not advance the gate itself.
