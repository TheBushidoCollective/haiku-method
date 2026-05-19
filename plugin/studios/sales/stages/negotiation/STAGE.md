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

Each unit walks three hats in `plan/do → legal-review → verify` order:

- **`negotiator`** (plan/do) handles objection responses and concession strategy. Every concession is traded, not given; every objection has an evidence-based reframe and a fallback position; the walk-away point is documented before negotiation opens.
- **`legal-reviewer`** (legal-review) reviews contract redlines, categorizes by legal vs commercial risk, recommends accept / counter / reject per item, and flags issues that need to escalate beyond field authority.
- **`verifier`** (verify) walks the unit body for completeness, objection-to-response traceability, walk-away documentation, and decision-register consistency — the body-only structural check architecture §9 requires. The legal-reviewer's redline opinion is the legal substance-check; the verifier confirms the body actually captured it.

## Inputs and outputs

The stage consumes `proposal/proposal-doc`. It produces the intent-scope `NEGOTIATION-TERMS.md` (declared in `discovery/`) which the close stage uses as the authoritative final terms record.

## Fix loop and gate

`fix_hats: [classifier, negotiator, feedback-assessor]` dispatches per finding. The gate is `[ask, await]` — `ask` for internal approval of the negotiated terms (deal desk, legal signoff on non-standard terms, executive approval for discounts beyond authority), `await` for the prospect's countersignature or counterproposal. Project overlays may add discount-authority matrices, named contract playbooks, or escalation-routing rules without modifying the plugin defaults.
