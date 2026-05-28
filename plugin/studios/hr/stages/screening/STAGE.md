---
name: screening
description: Resume review and initial candidate qualification
hats: [screener, assessor, verifier]
fix_hats: [classifier, screener, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: sourcing
    discovery: candidate-pipeline
  - stage: requisition
    discovery: job-spec
---

# Screening

Apply the requisition's must-have bar consistently across the sourced pipeline and produce a ranked shortlist for interview. This is where calibration matters most — the shortlist this stage produces is what the interview stage spends real human time on.

## Scope

Qualification and ranking against fixed criteria: per-candidate dispositions and a ranked shortlist. Screening decides *who is worth a human interview* — not who enters the funnel (sourcing) or what the bar should be (requisition). It works the existing pipeline against the existing criteria; it doesn't change either.

## What to do

- Apply the must-have criteria the same way to every candidate; consistency is the whole point of this stage.
- Cite the evidence behind each pass/fail call so a disposition is auditable, not a gut read.
- Flag edge cases explicitly rather than silently giving one candidate the benefit of the doubt and not another.
- Composite the dispositions into a ranked shortlist with a stated calibration rationale.

## What NOT to do

- Don't source new candidates or expand the pipeline — work what sourcing handed you.
- Don't conduct interviews or make a hire/no-hire call — that's the interview stage.
- Don't reinterpret the requisition's bar to fit a candidate you like.
- Don't let inconsistent application compound into a biased shortlist; where findings touch protected-class fairness or jurisdictional employment law, defer to human review and, where applicable, jurisdictional employment counsel — the plugin does not dispense legal interpretations.
