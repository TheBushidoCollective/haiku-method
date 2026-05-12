---
name: proposal
description: Create tailored proposals, demos, and business cases
hats: [proposal-writer, solution-architect, verifier]
fix_hats: [classifier, proposal-writer, feedback-assessor]
review: [ask, await]
elaboration: collaborative
inputs:
  - stage: qualification
    discovery: deal-brief
gate-protocol:
  timeout: 7d
  timeout-action: escalate
  escalation: comms
---

# Proposal

The proposal stage turns a qualified opportunity into the artifacts the prospect actually evaluates: a tailored business case, the technical solution architecture, and the demo / proof-of-value script. Per architecture §4.1 this is still a research/distillation stage (the artifact IS knowledge — the proposal document — not built code), and per-unit hats walk the standard plan-do-verify pattern.

## Per-unit baton

- **`proposal-writer`** (plan/do) takes the deal brief and writes the unit's slice of the proposal — outcomes tied to the prospect's named pain points, quantified ROI with stated assumptions, competitive differentiation, references relevant to this prospect's industry and scale.
- **`solution-architect`** (do) validates technical feasibility for the prospect's actual environment, designs the solution shape that fits their existing infrastructure, and flags implementation risks or prerequisites that affect timeline or scope.
- **`verifier`** (verify) validates the unit body for substance, citation, internal consistency, and decision-register alignment.

The two non-verify hats produce different surfaces of the same proposal — the writer owns the business narrative; the architect owns the technical shape. They are NOT redundant; the rally-race test (§2.3) holds because the writer's draft is incomplete until the architect grounds it in a deliverable solution, and the architect's solution is unsellable until the writer ties it to outcomes the buyer cares about.

## Inputs and outputs

The stage consumes `qualification/deal-brief`. It produces the intent-scope `PROPOSAL-DOC.md` (declared in `discovery/`) which the negotiation stage uses as its anchoring artifact.

## Fix loop and gate

`fix_hats: [classifier, proposal-writer, feedback-assessor]` dispatches per finding. The gate is `[ask, await]` — the user chooses between local approval (deal desk / sales engineering signoff in the team's review tool) and `await` for the prospect's evaluation response (the proposal has gone out; nothing should advance until the prospect engages). The `gate-protocol` block escalates to comms after 7 days of silence so a stalled deal doesn't sit hidden in the backlog.
