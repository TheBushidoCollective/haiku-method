---
name: sourcing
description: Identify candidate pools and conduct outreach
hats: [sourcer, recruiter, verifier]
fix_hats: [classifier, sourcer, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: requisition
    discovery: job-spec
---

# Sourcing

Build the candidate pipeline against the requisition's job spec. Sourcing is where the pipeline gets its volume, its diversity, and its first-touch experience. Pipeline composition decisions made here propagate forward — a homogeneous or thin pipeline at sourcing means a homogeneous or thin shortlist at screening, regardless of how rigorous the screening criteria are.

## Per-unit baton

Each unit (a candidate batch keyed to a sourcing channel or persona) walks the three hats in `plan → do → verify` order:

- **`sourcer`** (plan) reads the job spec, picks the channel category and persona, and identifies the prospect list with initial fit signals
- **`recruiter`** (do) runs the personalized outreach against that prospect list, tracks responses, and surfaces channel-effectiveness metrics
- **`verifier`** (verify) validates the unit's batch artifact for substance and operational completeness — advances or rejects

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

Upstream input is `requisition/job-spec` (must-haves, nice-to-haves, sourcing plan, compensation framing, known market constraints). The single output is `CANDIDATE-PIPELINE.md` at intent scope — the consolidated prospect list with channel mix, fit signals, and outreach status. Screening consumes this output to drive the qualification pass.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, sourcer, feedback-assessor]` dispatches per finding. The gate is `auto` — sourcing decisions are operational and reversible (add more sources, re-run outreach), so harness advancement is appropriate once the verifier signs off and the review agents close their findings. Pipeline-composition concerns (channel mix, persona coverage) surface through the diversity review agent and route back to the sourcer for resolution.
