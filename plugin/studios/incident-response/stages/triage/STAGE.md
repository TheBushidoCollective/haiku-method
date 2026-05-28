---
name: triage
description: Assess severity, identify blast radius, and assign ownership
hats: [incident-commander, first-responder, verifier]
fix_hats: [classifier, incident-commander, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
---

# Triage

The first response phase of an incident. An alert fired, a customer reported impact, or an operator noticed something wrong — and this stage converts that noisy signal into a structured incident with named ownership, a declared severity, and a known blast radius. It's the difference between "something might be wrong" and "we're running a SEV-2, the IC is named, comms are out."

## Scope

Incident framing: ownership, severity, and blast radius from the raw signal. Triage decides *what this incident is, how bad it is, and who runs it* — not why it's happening (investigate) or how to stop it (mitigate). It establishes the source of truth the rest of the response works from.

## What to do

- Declare the incident and assign roles — IC, scribe, comms lead — so ownership is unambiguous from the start.
- Classify severity against measured user impact, with a stated justification, not a gut tier.
- Confirm the incident is real with ground-truth signals and capture ephemeral diagnostic data before it rotates out.
- Scope the blast radius to include downstream dependencies, not just the surface that alerted.

## What NOT to do

- Don't chase root cause or build a timeline — that's the investigate stage.
- Don't apply fixes, rollbacks, or flags to stop impact — that's mitigate.
- Don't declare a severity the measured impact doesn't justify.
- Don't stall the structured incident waiting for perfect data; triage is time-critical and downstream stages refine it.
