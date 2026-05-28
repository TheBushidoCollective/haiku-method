---
name: launch
description: Coordinate multi-channel launch, schedule distribution, and activate campaigns
optional: true
hats: [campaign-manager, channel-coordinator, verifier]
fix_hats: [classifier, campaign-manager, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: content
    discovery: assets
---

# Launch

Take the approved content and put it live: sequence the activations across channels, verify each prerequisite before go-live, publish on schedule, and log what actually happened. This is the operational stage of the campaign — once channels activate, the cost of recall is real, so readiness is confirmed before each step fires.

## Scope

Coordinating and executing the multi-channel activation. Launch decides *what goes live, in what order, with which tracking, and when* — not the assets themselves (content) or the results analysis (measure). Units are launch steps with preconditions, an action, and a post-condition check; the output is the campaign log measure reads.

## What to do

- Sequence the activations and declare per-step preconditions, the action, and a post-condition check before firing.
- Verify prerequisites are actually in place before each go-live — tracking pixels before paid traffic, landing pages before email sends.
- Publish on schedule and log actual timestamps, channel, tracking, and initial signals.
- Name a rollback or recall path for steps where one is possible.

## What NOT to do

- Don't author or rewrite assets here — that's the content stage; launch distributes what was approved.
- Don't analyze or attribute results; that's measure reading the log you produce.
- Don't fire a step whose preconditions or tracking aren't confirmed in place.
- Don't activate channels the content and strategy didn't scope.
