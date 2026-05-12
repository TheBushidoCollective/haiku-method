---
name: stakeholder-review
description: Present to stakeholders, gather feedback, gain alignment
hats: [presenter, feedback-synthesizer, verifier]
fix_hats: [classifier, presenter, feedback-assessor]
review: external
elaboration: collaborative
inputs:
  - stage: roadmap
    discovery: roadmap-doc
---

# Stakeholder Review

Take the roadmap to the people who have to commit against it — executives, engineering leadership, sales, support — and come out with a decision, not just a meeting. This stage owns the framing, the synthesis of what came back, and the record of who agreed to what.

## Per-unit baton

Each stakeholder-review unit walks `plan → do → verify`:

- **`presenter`** (plan / package) shapes the roadmap into an audience-appropriate narrative for this stakeholder group — executive summary, strategic rationale, risk surface, the specific ask. Produces the presentation artifact.
- **`feedback-synthesizer`** (do / capture) records the actual stakeholder reactions during and after the session, classifies each item by whether it changes the strategy, refines it, or is noted-but-not-acted-on, and updates the alignment record with named decisions and owners.
- **`verifier`** (verify) validates the alignment record body-only — every decision has a named decision-maker, every contested item has an escalation path, every action item has an owner — and advances or rejects.

## Inputs and outputs

Consumes `roadmap/roadmap-doc`. Produces `discovery/ALIGNMENT-DOC.md` per topic capturing the decisions reached. This is the terminal stage of the studio.

## Fix loop and gate

`fix_hats: [classifier, presenter, feedback-assessor]` reopens the framing when feedback lands — usually because the presentation didn't surface a risk or trade-off the stakeholder needed to see. The gate is `external` — alignment is something an external decision-making body confirms (a leadership review forum, a steering committee, a customer-advisory signoff); the engine blocks until that signal arrives. Project overlays at `.haiku/studios/product-strategy/stages/stakeholder-review/` may pin presentation-platform conventions, distribution templates, or the team's alignment-recording style.
