---
name: document
description: Create evidence packages, audit trails, and compliance documentation
hats: [evidence-collector, documentation-writer, verifier]
fix_hats: [classifier, evidence-collector, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: remediate
    discovery: remediation-log
---

# Document

Assemble the auditor-facing artifact. Remediate produced the changes; this stage turns those changes and their evidence into a package an external auditor can navigate — an index over the collected evidence plus the narrative that ties each piece back to a specific control.

## Scope

Gathering evidence with provenance and writing the connecting narrative that lets an auditor follow the compliance story without reverse-engineering the implementation. Document decides *how the existing evidence is organized and explained* — it does not produce new findings (assess) or make remediation changes (remediate).

## What to do

- Collect each piece of evidence with full provenance: source, date, collector, and the control it supports.
- Map every piece of evidence to a control and back every narrative claim to specific evidence.
- Organize the package to the structure an auditor expects, so navigation is obvious rather than archaeological.
- Flag missing or weak evidence as a gap to resolve, not something to narrate around.

## What NOT to do

- Don't generate new compliance findings or re-grade controls — that's assess.
- Don't make or alter remediation changes — that's remediate.
- Don't write narrative that asserts a control is met without the cited evidence to prove it.
- Don't hand off a package with unmapped evidence or unsourced claims.
