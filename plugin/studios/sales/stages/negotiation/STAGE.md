---
name: negotiation
description: Handle objections, negotiate terms, and align stakeholders
hats: [negotiator, legal-reviewer, verifier]
fix_hats: [classifier, negotiator, feedback-assessor]
review: [ask, await]
elaboration: collaborative
inputs:
  - stage: proposal
    discovery: proposal-doc
---

# Negotiation

Negotiation is where a proposal becomes a signable agreement. The stage takes the `PROPOSAL-DOC.md` from proposal and produces a `NEGOTIATION-TERMS.md` — the objection log with evidence-based responses, the redline analysis with severity categorization, the mutual close plan, and the documented walk-away position. Per architecture §4.1 this is research/distillation (the artifact is the negotiated terms document, not built work), and units are negotiation topics (a specific objection cluster, a redline category, a stakeholder's position).

## Per-unit baton

- `negotiator` → `legal-reviewer`: objection log with evidence-based reframes + fallback positions + walk-away threshold + concession strategy.
- `legal-reviewer` → `verifier`: legal-reviewed terms (redlines categorized by legal vs commercial risk, accept / counter / reject recommendations per clause).

## Inputs and outputs

The stage consumes `proposal/proposal-doc`. It produces the intent-scope `NEGOTIATION-TERMS.md` (declared in `discovery/`) which the close stage uses as the authoritative final terms record.

## Fix loop and gate

`fix_hats: [classifier, negotiator, feedback-assessor]` dispatches per finding. The gate is `[ask, await]` — `ask` for internal approval of the negotiated terms (deal desk, legal signoff on non-standard terms, executive approval for discounts beyond authority), `await` for the prospect's countersignature or counterproposal. Project overlays may add discount-authority matrices, named contract playbooks, or escalation-routing rules without modifying the plugin defaults.
