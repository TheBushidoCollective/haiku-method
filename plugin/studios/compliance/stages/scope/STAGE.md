---
name: scope
description: Define the compliance framework, identify applicable controls, and map to systems
hats: [compliance-analyst, scope-definer, verifier]
fix_hats: [classifier, compliance-analyst, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
---

# Scope

Frame the compliance engagement before any assessment work begins. This stage produces the intent-scope `CONTROL-MAPPING.md` — the document every downstream stage reads to know which controls apply, which systems are in-scope, and what data sensitivity those systems handle. Get this wrong and the rest of the lifecycle assesses, remediates, or certifies the wrong surface.

## Per-unit baton

Each scoping unit walks the three hats in `plan → do → verify` order:

- **`compliance-analyst`** (plan) reads the engagement brief, names the applicable framework(s) and version(s), and identifies the control families in play
- **`scope-definer`** (do) maps controls to specific systems, services, and data flows; produces the system inventory and explicit in-scope / out-of-scope rationale
- **`verifier`** (verify) validates the scoping memo against substance, citation, and decision-register consistency, then advances or rejects to the responsible hat

Detailed process lives in each hat's md — this stage enforces the chain, not the substance.

## Inputs and outputs

This is the entry stage, so `inputs:` is empty. The output (`CONTROL-MAPPING.md`) is intent-scope and feeds the `assess` stage's per-control evaluation work plus every downstream stage's "is this in-scope?" question.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, compliance-analyst, feedback-assessor]` dispatches per finding — the classifier routes the FB to the right unit, `compliance-analyst` re-authors the scoping content, the assessor independently decides closure. The gate is `auto`: scoping decisions live in the body and downstream stages will surface real misclassifications via their own findings, so the engine advances once verifiers approve.

Project overlays at `.haiku/studios/compliance/stages/scope/` may add framework-specific conventions (control-id formatting, system-inventory templates, named GRC tooling) without modifying these plugin defaults.
