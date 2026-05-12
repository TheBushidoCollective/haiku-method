---
name: audit
description: Assess existing documentation, identify gaps, and prioritize what to write or update
hats: [auditor, gap-analyst, verifier]
fix_hats: [classifier, auditor, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
---

# Audit

Assess the existing documentation surface, identify gaps against what readers actually need, and rank them so the rest of the studio works on the right things in the right order. Audit is the research stage of this studio — its units are knowledge topics ("what's the current state of the API reference?", "which onboarding flows lack docs?"), not execution work.

## Per-unit baton

Each audit unit walks the three hats in `plan → do → verify` order:

- **`auditor`** (plan) takes a documentation area and inventories what currently exists, with currency and accuracy assessments per item
- **`gap-analyst`** (do) reads the inventory, identifies gaps against reader needs, and ranks them by user impact
- **`verifier`** (verify) confirms the knowledge artifact's substance, citations, and internal consistency before advancing

The baton across the chain: scoped doc area → inventory with currency flags → ranked gap list with severity and recommended doc type → validated artifact.

## Inputs and outputs

The audit stage takes no upstream inputs (it's the first stage in the studio). It produces `AUDIT-REPORT.md` — the prioritized gap analysis that drives outlining.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, auditor, feedback-assessor]` dispatches per finding. The classifier targets the FB to the unit, the auditor re-inventories or re-ranks, the assessor decides closure. The gate is `auto` — once the artifacts pass review and the user (or autopilot) advances, the audit hands off to outline.
