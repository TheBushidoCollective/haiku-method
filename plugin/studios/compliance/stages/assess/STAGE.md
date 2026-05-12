---
name: assess
description: Evaluate current state against controls, identify gaps and risks
hats: [auditor, risk-assessor]
fix_hats: [classifier, auditor, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: scope
    discovery: control-mapping
---

# Assess

Take the scoping memo and produce a defensible picture of where the organization stands against each in-scope control. This stage owns the intent-scope `GAP-REPORT.md` — the document the remediate stage uses to plan work and the certify stage uses to demonstrate audit readiness. Findings here drive everything downstream.

## Per-unit baton

Each assessment unit walks the hat chain in order:

- **`auditor`** (plan / do) reads the upstream `CONTROL-MAPPING.md`, evaluates each in-scope control against the current state of systems and processes, and records the determination (met / partial / unmet) with the specific evidence reviewed
- **`risk-assessor`** (do / verify) takes the auditor's findings and assigns likelihood + impact scores using a consistent methodology, then prioritizes the gap list

Note: this stage runs without a dedicated `verifier` hat — both hats produce body content and the second hat's risk-scoring pass acts as the substantive check on the first hat's findings. (Uncertainty flagged: pure plan → do → verify per architecture §3 would add a verifier hat; the current shape diverges. Not changing structure here.)

## Inputs and outputs

`scope/control-mapping` feeds in. The output `GAP-REPORT.md` is intent-scope and feeds both `remediate` (which gaps to close) and `certify` (which findings to demonstrate resolution for).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, auditor, feedback-assessor]` dispatches per finding — `auditor` is the implementer, re-evaluating the contested control or correcting the evidence trail. The gate is `ask`: a human approves locally because assessment findings carry organizational and legal weight that benefits from a deliberate sign-off before remediation work begins. Project overlays may add framework-specific scoring rubrics or evidence-collection conventions.
