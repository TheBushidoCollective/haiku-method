---
name: assess
description: Evaluate current state against controls, identify gaps and risks
hats: [auditor, risk-assessor, verifier]
fix_hats: [classifier, auditor, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: scope
    discovery: control-mapping
---

# Assess

Take the scoped control set and produce a defensible picture of where the organization actually stands against each in-scope control. This is the stage that grades reality against the framework and turns the result into a prioritized gap list the rest of the lifecycle acts on.

## Scope

Evaluating each in-scope control as met, partial, or unmet on cited evidence, then ranking the gaps by risk. Assess decides *how well controls are satisfied today and which gaps matter most* — it does not redefine what's in scope (that's scope) or close any gap (that's remediate).

## What to do

- Determine each control's status against concrete, cited evidence — never on assertion or assumption.
- Separate likelihood from impact when ranking gaps, and apply the same scoring method consistently across findings.
- Make every finding traceable back to the control it grades and forward to the evidence that supports it.
- Surface contested or ambiguous determinations rather than rounding them to a convenient verdict.

## What NOT to do

- Don't change the in-scope boundary or reclassify systems — that's the scope stage.
- Don't design or implement fixes — that belongs to remediate.
- Don't grade a control without the evidence to back the grade.
- Don't leave a gap unranked; an unprioritized finding gives remediation no order to work in.
