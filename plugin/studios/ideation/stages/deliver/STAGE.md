---
name: deliver
description: Finalize and package the deliverable for its audience
hats: [delivery-planner, publisher, verifier]
fix_hats: [classifier, publisher, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: create
    discovery: draft-deliverable
  - stage: review
    discovery: review-report
---

# Deliver

Finalize and package the deliverable for its audience. The draft from `create` plus the findings from `review` go in; an audience-ready final artifact comes out. This stage incorporates surviving review findings, adjusts tone and structure for the target audience, and packages the final form (formatting, attribution, table of contents, links).

## What a unit IS for this stage

Each unit is a **delivery action** — one concrete operational step with preconditions, an unambiguous action, a verifiable post-condition check, and a rollback or forward-fix path. Typical actions: incorporate critical findings, format for audience, finalize attribution, validate links, package for the delivery channel.

## Per-unit baton

- `delivery-planner` → `publisher`: delivery plan (which findings to incorporate, target audience adaptations, packaging artifacts to produce).
- `publisher` → `verifier`: audience-ready deliverable + operational record (preconditions, action, post-condition check, rollback).

## Inputs and outputs

Inputs: `create/draft-deliverable`, `review/review-report`. Output: per-unit operational records composing into `FINAL-DELIVERABLE.md` at intent scope, plus any side artifacts the delivery channel requires (formatted exports, attribution appendix, link manifest).

## Fix loop and gate

When intent-completion review feedback opens, `fix_hats: [classifier, publisher, feedback-assessor]` dispatches per finding. Gate is `auto` — by `deliver` the human-decision points have already happened (in `create`'s `ask` gate and `review`'s `ask` gate). Anything still open at this stage is operational.
