---
name: close
description: Execute the deal, handoff to customer success, and document learnings
hats: [closer, handoff-coordinator, verifier]
fix_hats: [classifier, closer, feedback-assessor]
review: [external, await]
elaboration: collaborative
inputs:
  - stage: negotiation
    discovery: terms
---

# Close

Close is the operational stage of the sales lifecycle — verbal agreement turns into a fully executed contract, the prospect becomes a customer, and the relationship hands to the team that will deliver the work. Per architecture §4.5 this is operational (units are operational steps — secure signature, verify PO, package handoff, write win/loss). The artifact is the `HANDOFF-PACKAGE.md` that customer success or implementation inherits.

## Per-unit baton

- **`closer`** (plan/do) drives the deal across the line — confirms final terms, sequences signature collection through the buyer's procurement process, verifies purchase order and payment terms, and ensures no verbal commitment goes undocumented before contract execution.
- **`handoff-coordinator`** (do) packages the full deal context — relationship history, named contacts, commitments made during sales, known risks or sensitivities — so the receiving team starts from a complete picture, not from the contract alone.
- **`verifier`** (verify) validates the unit body for substance, citation, internal consistency, and that nothing live to the prospect is missing from the closed record.

## Inputs and outputs

The stage consumes `negotiation/terms`. It produces the intent-scope `HANDOFF-PACKAGE.md` (declared in `discovery/`) which is the seam between sales and whichever post-sale team owns the relationship next.

## Fix loop and gate

`fix_hats: [classifier, closer, feedback-assessor]` dispatches per finding. The gate is `[external, await]` — `external` because contract execution is signaled by the prospect's countersignature in the contracting system (DocuSign-equivalent, e-signature platform, or wet-ink for some industries), `await` for the procurement / legal steps that the seller doesn't control. Project overlays may add team-specific handoff templates, named CRM stage-transition rules, or win/loss capture frameworks without modifying the plugin defaults.
