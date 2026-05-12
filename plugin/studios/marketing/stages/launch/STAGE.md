---
name: launch
description: Coordinate multi-channel launch, schedule distribution, and activate campaigns
hats: [campaign-manager, channel-coordinator, verifier]
fix_hats: [classifier, campaign-manager, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: content
    discovery: assets
---

# Launch

Take the approved content and put it live: define the activation sequence across channels, verify prerequisites are in place before each go-live (tracking pixels before paid traffic, landing pages before email sends), publish on schedule, and log what actually happened. This is the operational stage — units are launch steps, not assets.

## Per-unit baton

Each launch unit walks the three hats in `plan → do → verify` order:

- **`campaign-manager`** (plan) — sequences the activations, declares preconditions / actions / post-condition checks per step, names the rollback path
- **`channel-coordinator`** (do) — executes the step on the appropriate channel category (paid, owned, earned, direct), confirms delivery, logs actual timestamps and initial signals
- **`verifier`** (verify) — confirms preconditions were met, the post-condition check produced a pass signal, and the campaign log captured what's needed for the `measure` stage

A unit here is one launch step (e.g. "activate email send", "enable paid placement", "publish landing page"). Steps with dependencies declare them so the engine can sequence correctly.

## Inputs and outputs

Consumes `content/assets` (approved, channel-ready content from the content stage). Produces a campaign log — the source of truth for what went live when, on which channel, with which tracking — which the `measure` stage reads to attribute results.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, campaign-manager, feedback-assessor]` dispatches per finding. The gate is `ask` — the user confirms each readiness check locally before the launch actually fires, because once channels are activated the cost of recall is real.
