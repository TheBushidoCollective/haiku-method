---
name: manufacturing
description: DFM, assembly process, QA sampling, and production ramp
hats: [manufacturing-engineer, qa-lead, verifier]
fix_hats: [classifier, manufacturing-engineer, feedback-assessor]
review: await
elaboration: autonomous
inputs:
  - stage: design
    output: schematic
  - stage: design
    output: bom
  - stage: firmware
    output: firmware-binary
  - stage: validation
    output: certification
---

# Manufacturing

Design-for-manufacturability (DFM) review, assembly process definition,
QA sampling plan, production ramp, and first-article inspection.
Manufacturing decisions lock in — once tooling is cut and the assembly
line is running, changes are expensive and slow. First-article
inspection is the last cheap chance to catch a problem before it ships
at volume.

## Per-unit baton

Each manufacturing unit walks `plan → do → verify`:

- **`manufacturing-engineer`** (plan / do) reads the design + firmware +
  validation outputs, owns the DFM review, defines the assembly process
  (line layout, station operations, takt time), and coordinates with the
  chosen contract manufacturer.
- **`qa-lead`** (do) owns the production quality plan — incoming
  inspection, in-process checks, end-of-line functional test, sampling
  plan, defect classification, escalation.
- **`verifier`** (verify) checks each operational unit for stated
  preconditions, unambiguous action, verifiable post-condition, and
  rollback or scrap policy where applicable — body only.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, manufacturing-engineer,
feedback-assessor]` dispatches per finding. The manufacturing-engineer is
the implementer because most manufacturing findings are about process
correctness, fixture coverage, or DFM gaps that need the originating role
to fix. The gate is `await` — manufacturing readiness typically depends
on an external event (CM signoff on tooling, first-article inspection
pass, regulatory cert return) rather than a synchronous review.
