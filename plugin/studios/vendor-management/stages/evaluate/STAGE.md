---
name: evaluate
description: Assess vendors and score against criteria
hats: [evaluator, technical-reviewer]
fix_hats: [classifier, evaluator, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: requirements
    discovery: rfp-document
---

# Evaluate

Score and shortlist vendor responses against the RFP's evaluation criteria. This stage takes the RFP and the scoring methodology produced by `requirements` and produces a comparative scorecard that the negotiation stage will use to drive its counter-positions.

## Per-unit baton

Each unit walks the hat chain in order:

- **`evaluator`** (plan / do) applies the pre-defined scoring methodology to every vendor response, calculates total cost of ownership, and produces a comparative ranking with documented rationale per score
- **`technical-reviewer`** (verify lens) validates the technical claims through proof-of-concept testing, reference checks with actual customers, and integration / architecture compatibility assessment — flags any vendor whose scored capabilities don't survive hands-on verification

The baton between the two is the scorecard plus the score rationale. The technical reviewer either confirms scores stand or files findings against the entries the verification couldn't support.

## Inputs and outputs

`requirements/rfp-document` feeds in. The output is the vendor scorecard (`outputs/VENDOR-SCORECARD.md`) — a per-vendor ranking with documented rationale, TCO analysis, and verified technical assessment — which feeds `negotiate`.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, evaluator, feedback-assessor]` dispatches per finding — the classifier routes, the evaluator re-runs the affected scoring or rationale, and the assessor independently decides closure. The gate is `ask` — a human stakeholder approves the shortlist locally before negotiation contact begins. Project overlays may add house-style scoring schemes, organization-specific TCO categories, or industry-specific verification protocols without modifying the plugin defaults.
