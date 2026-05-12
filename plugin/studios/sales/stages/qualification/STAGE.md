---
name: qualification
description: Qualify the opportunity against ICP, budget, authority, need, and timeline
hats: [qualifier, deal-strategist, verifier]
fix_hats: [classifier, qualifier, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: research
    discovery: prospect-brief
---

# Qualification

Qualification is the gate that decides whether a prospect is a real opportunity or a polite tour through the pipeline. The stage takes the `PROSPECT-BRIEF.md` from research and produces a `DEAL-BRIEF.md` — a defensible go/no-go, an evidence-backed scoring against the seller's ICP and a chosen qualification framework (BANT, MEDDIC, GAP, SPIN, or the team's own), and a deal strategy with named champion, identified economic buyer, and a risk register. This is a research/distillation stage per architecture §4.1; units are qualification topics (BANT dimension, buying-committee mapping, champion analysis, etc.), not execution work.

## Per-unit baton

- **`qualifier`** (plan/do) reads the prospect brief plus any discovery-call notes and scores the opportunity against the chosen qualification framework. Each criterion gets an evidence-backed rating, not an optimistic guess.
- **`deal-strategist`** (do) turns the qualification scoring into a forward plan — champion development, multi-thread strategy, anticipated objections, competitive positioning, mutual close plan.
- **`verifier`** (verify) validates the unit body for substance, citation, internal consistency, and decision-register alignment.

## Inputs and outputs

The stage consumes `research/prospect-brief`. It produces the intent-scope `DEAL-BRIEF.md` (declared in `discovery/`) which downstream stages depend on.

## Fix loop and gate

`fix_hats: [classifier, qualifier, feedback-assessor]` dispatches per open finding. The gate is `ask` — a sales manager or deal-desk reviewer approves the qualification locally before the team invests in proposal work. Project overlays may add house-style scoring rubrics, named qualification playbooks, or team-specific risk taxonomies without modifying the plugin defaults.
