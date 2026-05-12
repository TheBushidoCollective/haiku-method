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

Assemble the auditor-facing artifact. The remediate stage produced changes; this stage turns those changes plus their evidence into the package an external auditor will navigate. The output is the intent-scope `EVIDENCE-PACKAGE.md` — an index over the collected evidence with the narrative documentation that ties each piece of evidence back to a specific control.

## Per-unit baton

Each documentation unit walks the three hats in `plan → do → verify` order:

- **`evidence-collector`** (plan / do for artifacts) gathers the raw evidence — screenshots, log excerpts, config dumps, policy PDFs, attestation records — and records the provenance (source, date, collector, control it supports) for each piece
- **`documentation-writer`** (do for narrative) writes the connecting narrative: control descriptions, audit trail summaries, the end-to-end compliance story that lets an auditor follow the evidence without reverse-engineering the implementation
- **`verifier`** (verify) validates that every piece of evidence is mapped to a control, every narrative claim cites specific evidence, and the package is organized to the auditor's expected structure

## Inputs and outputs

`remediate/remediation-log` feeds in. The output `EVIDENCE-PACKAGE.md` is intent-scope and is the primary input to `certify`, where the audit-liaison hat presents it to the external auditor.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, evidence-collector, feedback-assessor]` dispatches per finding — `evidence-collector` re-gathers missing evidence or fixes provenance gaps; narrative-only findings route via the classifier to `documentation-writer` through a separate dispatch. The gate is `ask`: a human approves locally before the package is handed to certify, because evidence sufficiency is a judgment call the auditor will second-guess and the team needs to align before that conversation. Project overlays may add the project's specific evidence-platform conventions (folder structures, naming schemes, redaction rules).
