---
name: firmware
description: Embedded software for the hardware platform
hats: [firmware-engineer, reviewer, verifier]
fix_hats: [classifier, firmware-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: requirements
    discovery: functional-requirements
  - stage: design
    output: schematic
---

# Firmware

Implement the embedded software that runs on the hardware platform. Firmware works under constraints application development never faces — finite memory, flash, and power budgets; hard real-time deadlines; field updates that may need physical access; and far harder debugging. "It works on the bench" is not validation for code shipping inside a physical product.

## Scope

The embedded software against the design and requirements: the implementation, its tests, and the on-target measurements that prove it fits the budgets. Firmware decides *how the platform behaves in software* — not the hardware design it runs on (design) and not the final validation of the whole product (validation).

## What to do

- Implement against the functional requirements and the design's actual hardware, not an idealized board.
- Respect the memory, flash, power, and timing budgets, and measure them on real hardware rather than assuming.
- Trace every safety-critical path to a documented hazard mitigation and make it provably correct.
- Ship tests and on-target measurements alongside the implementation, not as a follow-up.

## What NOT to do

- Don't redesign the hardware or change the schematic to suit the software — that's a revisit to design.
- Don't run the product's validation campaign (HIL, environmental, cert) — that's the validation stage.
- Don't treat a bench pass as validation for a safety-critical path.
- Don't exceed a resource budget and leave it for validation to discover.
