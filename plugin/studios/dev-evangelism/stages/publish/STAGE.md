---
name: publish
description: Distribute content across channels
hats: [distributor, community-manager, verifier]
fix_hats: [classifier, distributor, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: create
    discovery: content-package
outputs:
  - discovery: distribution-log
    hat: distributor
---

# Publish

Publish is the operational stage of the dev-evangelism lifecycle. It takes the produced content package and executes a multi-channel distribution plan — written channels, video channels, social channels, podcasts, conference submissions, community forums — adapting format per channel rather than cross-posting identical copies.

Distribution is one half of the stage; community seeding is the other. Posting an asset and walking away gets you reach without engagement. Posting an asset AND showing up in the comments / threads / replies in the first 24-48 hours is what turns reach into conversation.

## Per-unit baton

Units here are **channel deployments** (one per channel-asset pair, or per channel cluster). Each unit walks the three hats in `plan → do → verify` order:

- **`distributor`** (plan / do for the publish itself) adapts the asset to the channel's format / tone / metadata norms, runs the publish action, and records timestamp + URL + tracking
- **`community-manager`** (do for seeding) initiates discussion in the relevant developer communities, monitors early reactions, and responds in voice
- **`verifier`** (verify) validates the publish record against completeness / tracking-active / adaptation-evidence rules and advances or rejects to the responsible hat

The baton: content package → channel-adapted asset (distributor publishes, records) → seeded conversation with monitoring (community-manager) → validated publish record (verifier).

## Inputs and outputs

Upstream `create/content-package` feeds in. The output is the intent-scope `DISTRIBUTION-LOG.md` capturing every publish (timestamp, channel, URL, platform-specific metadata, adaptation notes, initial engagement snapshot).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, distributor, feedback-assessor]` dispatches per finding. The gate is `auto` — the human approval already happened at the create gate, so publish advances on its own once the verifier confirms every distribution row is complete and tracking is live.
