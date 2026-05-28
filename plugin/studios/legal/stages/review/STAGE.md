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

Substantive review of the draft against the brief, the research memo, and the applicable compliance requirements, producing the findings the execute stage will close before signature. Review surfaces issues for the attorney; it does not certify legal sufficiency. A finding marked critical means "the attorney should look here first," not "this is legally defective."

## Scope

Examining the draft for unintended exposure, unaddressed risks, and compliance gaps, and recording specific, traceable findings. Review decides *where the draft falls short of the brief and the regulations* — not what the document should have said in the first place (draft), and not the final go/no-go on execution (the attorney, at the gate).

## What to do

- Read the draft against the brief and memo, and flag provisions that create unintended exposure or fail to address an identified risk.
- Map the draft against the regulatory regimes research identified and note specific compliance gaps.
- Make every finding specific, severity-tagged, and traceable to a clause plus its brief or memo reference.
- Route a finding that requires rewriting a clause back to the draft stage rather than fixing it in place.

## What NOT to do

- Don't certify the document as legally sufficient — that judgment is the attorney's.
- Don't rewrite clauses here; review produces findings, draft produces language.
- Don't file a vague finding ("tighten this up") with no clause anchor or severity.
- Don't advance with an open critical finding that hasn't been resolved or formally waived.
