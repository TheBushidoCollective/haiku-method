---
name: prioritization
description: Score and rank opportunities using impact/effort frameworks
hats: [prioritizer, stakeholder-proxy, verifier]
fix_hats: [classifier, prioritizer, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: user-research
    discovery: insights-report
---

# Prioritization

Turn the opportunity list into a defensible ordering. Every ranking is a trade-off; this stage makes the trade-off explicit, anchors it in evidence, and pressure-tests it against stakeholders who aren't in the room.

## Per-unit baton

Each prioritization unit walks `plan → do → verify`:

- **`prioritizer`** (plan / score) applies a chosen prioritization framework (RICE, ICE, MoSCoW, weighted scoring, or another the team uses) to the opportunities in the unit's topic. Captures the framework choice, the weights, and the reasoning per score.
- **`stakeholder-proxy`** (do / pressure-test) represents absent stakeholders — business, engineering, sales, support — and surfaces the objections the ranking will face once it leaves this stage. Updates the artifact with documented stakeholder constraints.
- **`verifier`** (verify) validates the artifact body-only — consistent framework application, evidence behind each estimate, named trade-offs — and advances or rejects with a specific criterion.

## Inputs and outputs

Consumes `user-research/insights-report` so prioritization is grounded in real user signal, not internal preference. Produces `discovery/PRIORITY-MATRIX.md` per topic, which feeds `roadmap`.

## Fix loop and gate

`fix_hats: [classifier, prioritizer, feedback-assessor]` reopens the scoring on findings. The gate is `ask` — prioritization is the decision point where the user can no longer defer trade-offs, so the human review is load-bearing. Project overlays at `.haiku/studios/product-strategy/stages/prioritization/` may pin a specific prioritization framework, scoring conventions, or links into the team's prioritization tool of record.
