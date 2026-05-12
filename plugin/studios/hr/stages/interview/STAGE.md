---
name: interview
description: Conduct structured interviews and evaluate candidates
hats: [interviewer, evaluator, verifier]
fix_hats: [classifier, interviewer, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: screening
    discovery: screening-report
  - stage: requisition
    discovery: job-spec
---

# Interview

Convert the screening shortlist into a calibrated, evidence-based hire / no-hire recommendation. Interview is the most expensive stage in the lifecycle — real interviewer time per candidate, real candidate time, real opportunity cost on both sides. The structure exists to make that time produce signal, not impressions.

## Per-unit baton

Each unit (a single candidate's interview record) walks the three hats in `plan → do → verify` order:

- **`interviewer`** (plan + do) prepares a structured question set against the competency dimensions, conducts the interview, captures candidate responses with specific examples, and produces an independent assessment
- **`evaluator`** (do — synthesize) aggregates interviewer scores across the panel, facilitates the debrief, resolves disagreements through evidence review, and produces the hire / no-hire recommendation with rationale
- **`verifier`** (verify) validates the unit's interview record for substance, evidence completeness, and decision-register consistency — advances or rejects

The interviewer is paired plan-and-do because a single interview run is inseparable: the question plan and the conducted interview produce one artifact. The evaluator runs after every interviewer in the panel has produced an independent assessment; cross-interviewer synthesis is a distinct activity, not part of conducting an individual interview.

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

Upstream inputs are `requisition/job-spec` (success outcomes, must-have competencies, seniority calibration) and `screening/screening-report` (the ranked shortlist with suggested interview focus areas per candidate). The single output is `INTERVIEW-SCORECARD.md` at intent scope — every interviewed candidate's panel-aggregated scorecard with evidence, debrief synthesis, and hire / no-hire recommendation.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, interviewer, feedback-assessor]` dispatches per finding. The classifier routes; the interviewer re-authors the affected scorecard sections with corrected evidence framing; the assessor decides closure. The gate is `ask` — a human approver signs off because hire / no-hire recommendations are consequential and not safely auto-advanced.

Sensitive topic note: interview decisions are a hot surface for protected-class fairness, ADA accommodations, jurisdictional interview-conduct rules, and reference-check requirements. The fairness review agent looks for bias patterns; where findings touch employment law or accommodation rules, defer to human review and, where applicable, jurisdictional employment counsel — the plugin does not dispense legal interpretations.
