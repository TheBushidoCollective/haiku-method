---
name: content
description: Create campaign assets — copy, visuals, landing pages, emails
hats: [content-creator, copy-editor, verifier]
fix_hats: [classifier, content-creator, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: strategy
    discovery: messaging-framework
---

# Content

Produce the campaign assets the launch stage will distribute: copy, landing pages, emails, social posts, ad creative. Every asset executes the approved messaging framework for a specific audience segment on a specific channel. This is where the strategy becomes something a customer can actually read or see.

## Per-unit baton

Each content unit walks the three hats in `plan → do → verify` order:

- **`content-creator`** (plan + do) — adapts the messaging framework to this asset's channel and segment, produces drafted copy and asset specifications
- **`copy-editor`** (do — refinement) — sharpens the creator's draft for clarity, tone fit, and call-to-action strength without rewriting from scratch
- **`verifier`** (verify) — confirms the asset is on-message, on-brand, complete (no placeholders), and traceable to the strategy

A unit here is one asset family (e.g. "launch email sequence", "primary landing page", "channel A ad set") — not one channel post.

## Inputs and outputs

Consumes `strategy/messaging-framework` (value proposition, proof points, tone, audience-to-channel map). Produces channel-ready content assets and per-asset rationale linking back to the messaging framework, which the `launch` stage distributes.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, content-creator, feedback-assessor]` dispatches per finding — the copy-editor is intentionally not in the fix loop because the creator owns the underlying messaging choices. The gate is `ask` — the user approves assets locally before distribution, since live channel mistakes are expensive to retract.
