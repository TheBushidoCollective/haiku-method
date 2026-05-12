---
name: decide
description: Apply decision framework and produce recommendation
hats: [advisor, facilitator, verifier]
fix_hats: [classifier, advisor, feedback-assessor]
review: external
elaboration: collaborative
inputs:
  - stage: evaluate
    discovery: evaluation-report
  - stage: options
    discovery: options-matrix
---

# Decide

Convert the evaluation into a recommendation that a decision-maker (executive, board, investment committee) can ratify or reject. The deliverable is a **decision brief** — clear recommendation, strongest arguments for and against, named dissents, accountability for who decided what.

Units in this stage are **decision artifacts** — operational ratification steps with concrete preconditions, the decision action itself, and verifiable post-conditions (e.g. "board ratification", "investment committee approval", "executive sign-off with named dissents recorded"). The stage output `DECISION-BRIEF.md` carries the recommendation and the decision record.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`advisor`** (plan) drafts the recommendation following from the evaluation evidence — supporting case + counterarguments + acknowledged risks
- **`facilitator`** (do) runs the decision conversation, captures areas of agreement and disagreement, and documents dissents transparently
- **`verifier`** (verify) checks preconditions, action, post-condition, and rollback are all stated; checks decision-register consistency

## Inputs and outputs

Consumes `evaluate/evaluation-report` and `options/options-matrix`. Produces `decision-brief` at intent scope, including the recorded decision, dissents, and the rationale chain back to the evaluation.

## Fix loop and gate

`fix_hats: [classifier, advisor, feedback-assessor]` dispatches per finding. The gate is `external` — the brief goes out for external ratification (board / investment committee / executive sign-off), and the workflow blocks until the external decision system signals approval (typically branch merge in the project's tracking system, or an explicit external acknowledgement). Project overlays may add house-style decision-record formats, signoff routing, and dissent-capture conventions.
