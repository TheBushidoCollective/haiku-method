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

Get the validated design into volume production: design-for-manufacturability review, assembly process definition, QA sampling plan, production ramp, and first-article inspection. Manufacturing decisions lock in — once tooling is cut and the line is running, changes are expensive and slow.

## Scope

Production readiness and ramp: the DFM review, the assembly process (line layout, station operations, takt time), and the quality plan that catches defects before volume. Manufacturing decides *how the validated design gets built repeatably at scale* — not the design itself (design) and not whether it meets its requirements (validation).

## What to do

- Run the DFM review against the actual design and BOM, surfacing manufacturability gaps before tooling is cut.
- Define the assembly process concretely — line layout, per-station operations, takt time.
- Build the quality plan end to end: incoming inspection, in-process checks, end-of-line functional test, sampling, defect classification.
- Treat first-article inspection as the last cheap chance to catch a problem before it ships at volume.

## What NOT to do

- Don't change the design or BOM to ease manufacturing — a real manufacturability problem is a revisit to design.
- Don't run validation or certification work — consume validation's output as a precondition.
- Don't ramp to volume past an unresolved first-article finding.
- Don't define a process step without a verifiable post-condition and a scrap or rework policy.
