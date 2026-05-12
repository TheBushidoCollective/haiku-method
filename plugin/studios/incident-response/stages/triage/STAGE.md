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

The first response phase. An alert fired, a customer reported impact, or an operator noticed something wrong — and the job of this stage is to convert that noisy signal into a structured incident with named ownership, declared severity, and a known blast radius. Triage is the difference between "something might be wrong" and "we are running incident SEV-2, IC is named, comms are out."

## Per-unit baton

Each triage unit walks `incident-commander → first-responder → verifier` in order. A unit here is one triage decision — declaring the incident, classifying severity, or scoping the blast radius for a specific surface:

- **`incident-commander`** (plan) takes ownership, declares severity (SEV-1 / SEV-2 / SEV-3), assigns roles, and frames the response. The baton: a declaration with named IC, scribe, comms lead, and a stated severity with justification.
- **`first-responder`** (do) confirms the incident is real with ground-truth signals, captures ephemeral diagnostic data before it rotates out of the observability platform, and measures actual user impact. The baton: an `INCIDENT-BRIEF.md` slice with timestamps, affected surfaces, sample errors, and the user-impact number that justified the severity.
- **`verifier`** (verify) checks the brief against the stage's body-level rules — severity matches measured impact, blast radius accounts for downstream dependencies, escalation path matches the severity tier. Advances or rejects to the responsible hat.

## Inputs and outputs

This is the first stage in the lifecycle, so `inputs:` is empty — triage works from the raw signal (alert payload, customer report, dashboard observation) that the user brings to the intent. The output `INCIDENT-BRIEF.md` feeds every downstream stage and is the source of truth for "what is this incident."

## Fix loop and gate

When review feedback opens against a triage decision, `fix_hats: [classifier, incident-commander, feedback-assessor]` dispatches per finding. The IC re-owns the corrected decision because severity and ownership are IC-scope choices. The gate is `auto` because triage is time-critical — the workflow advances as soon as the verifier signs off so investigation can start without waiting on a human approval round.
