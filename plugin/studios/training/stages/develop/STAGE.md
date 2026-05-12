---
name: develop
description: Create training content and materials
hats: [developer, editor, verifier]
fix_hats: [classifier, developer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: design
    discovery: curriculum-plan
  - stage: needs-analysis
    discovery: needs-assessment
---

# Develop

Build the actual training materials called for by the curriculum plan — facilitator guides, participant workbooks, slides, videos, exercises, assessment instruments, job aids. This is the build-class stage of the training lifecycle: every output is something a facilitator or a learner will hold and use during delivery.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`developer`** (plan / do) authors the materials for one curriculum element — facilitator guide, participant materials, exercises, assessment instruments — following the instructional strategy declared in the curriculum plan
- **`editor`** (do — quality pass) reviews for consistency across modules, audience-appropriate language, accessibility (alt text, captions, contrast), and accuracy
- **`verifier`** (verify) validates the artifact against the unit's acceptance criteria, citing concrete pass/fail signals — advances or rejects to the responsible hat

The detailed process for each role lives in the hat's md file. This stage's job is to enforce the chain.

## Inputs and outputs

Reads `design/curriculum-plan` and `needs-analysis/needs-assessment` for every unit. Output is `TRAINING-MATERIALS.md` per unit — an index that points to the produced asset set (facilitator guide path, participant materials path, assessment instrument path, accessibility-check notes).

## Fix loop and gate

Review feedback dispatches the `fix_hats: [classifier, developer, feedback-assessor]` chain. Gate is `ask` — the user approves the materials before delivery is scheduled, because issues caught here are cheap to fix and impossibly expensive to fix mid-cohort. Project overlays at `.haiku/studios/training/stages/develop/` may add house conventions (organization-specific authoring tool, brand templates, named accessibility standard, internal review workflow) without modifying the plugin defaults.
