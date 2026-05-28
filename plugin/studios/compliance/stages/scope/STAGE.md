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

The opening stage of the compliance lifecycle: frame the engagement before any assessment begins. This is where the applicable framework, the in-scope systems, and the data sensitivity get pinned down — the boundary every later stage assesses, remediates, certifies, and documents against.

## Scope

Naming the framework(s) and version(s) in play, mapping their control families to specific systems and data flows, and drawing an explicit in-scope / out-of-scope line with rationale. Scope decides *what compliance surface is in play* — not whether each control is met (that's assess), nor how to close a gap (that's remediate).

## What to do

- Identify the applicable framework(s) and version(s) precisely; cite the controlling authority, not a paraphrase.
- Inventory the systems, services, and data flows each control family touches, and classify the data sensitivity each carries.
- State the in-scope / out-of-scope boundary explicitly, with a defensible reason for every exclusion.
- Produce a control mapping concrete enough that a downstream stage can answer "is this in-scope?" without re-deciding it.

## What NOT to do

- Don't evaluate whether controls are met or rank gaps — that's the assess stage.
- Don't design or implement control changes — that belongs to remediate.
- Don't leave a system unclassified or an exclusion unjustified; an ambiguous boundary here misdirects every stage that follows.
- Don't assume what a source's docs claim about its data; scope what's actually true.
