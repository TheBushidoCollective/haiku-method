---
name: screening
description: Resume review and initial candidate qualification
hats: [screener, assessor]
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

Apply the requisition's must-have bar consistently across the sourced pipeline, producing a ranked shortlist for the interview stage. Screening is where calibration matters most: small inconsistencies in how the criteria are applied (a candidate who got the benefit of the doubt; another who didn't) compound into systematically biased shortlists. The shortlist this stage produces is what the interview stage spends real human time on.

## Per-unit baton

Each unit (a candidate batch from the sourcing pipeline) walks two hats:

- **`screener`** (do) applies must-have / nice-to-have criteria per candidate, documents pass/fail with specific evidence, flags edge cases
- **`assessor`** (verify + synthesize) reviews screener decisions for calibration consistency, scores candidates on a composite metric, produces the ranked shortlist, and identifies pool-composition patterns

The assessor doubles as the verify role for this stage — calibrating the screener's decisions and either accepting or rejecting the shortlist for downstream use.

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

Upstream inputs are `requisition/job-spec` (must-have criteria, success outcomes, seniority calibration) and `sourcing/candidate-pipeline` (the screening-eligible candidates with outreach context). The single output is `SCREENING-REPORT.md` at intent scope — every screened candidate's evaluation with score, evidence, and disposition, plus the ranked shortlist for interview.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, screener, feedback-assessor]` dispatches per finding. The classifier routes; the screener re-applies criteria with the updated framing; the assessor decides closure. The gate is `auto` — screening decisions can be re-run cheaply if the shortlist is wrong, so harness advancement is appropriate once the review agents close.

Sensitive topic note: screening decisions are where disparate-impact patterns most often surface. The consistency review agent looks for these signals; where findings touch protected-class fairness or jurisdictional employment law, defer to human review and, where applicable, jurisdictional employment counsel — the plugin does not dispense legal interpretations.
