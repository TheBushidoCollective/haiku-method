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

Implement the embedded software that runs on the hardware platform.
Firmware operates under constraints that application development does
not face: memory, flash, and power budgets are finite; real-time
deadlines are often hard; field updates may require physical access; and
debugging is much harder than on host-side code. Safety-critical paths
must be traceable to a documented hazard mitigation and provably correct
— "it works on the bench" is not validation for code shipping in a
physical product.

## Per-unit baton

Each firmware unit walks three hats in `plan/do → lens-review → verify` order:

- **`firmware-engineer`** (plan / do) reads the requirements + the
  schematic (for peripherals, pin assignments, supply rails) and lands
  the code, tests, and on-target measurements for this unit's scope.
- **`reviewer`** (lens-review) checks the unit against functional
  requirements, safety analysis, and memory / flash / power budgets;
  surfaces concerns through the firmware-domain lens.
- **`verifier`** (verify) walks the unit body's substance,
  requirements-traceability, on-target measurement evidence, and
  decision-register consistency — the body-only structural check
  architecture §9 requires.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, firmware-engineer,
feedback-assessor]` dispatches per finding: the classifier routes; the
firmware-engineer lands the corrective edits and tests; the assessor
independently decides closure. The gate is `[external, ask]` — firmware
that ships into a physical product typically wants peer-review signoff
external to the agent loop.

## Tooling

The plugin default does not prescribe a firmware toolchain. Compiler,
debugger, RTOS choice, build system, and on-target test harness belong
in a project overlay at `.haiku/studios/hwdev/stages/firmware/`. The
plugin defaults reference toolchain capabilities generically (build,
flash, run on target, measure resource usage, measure timing) without
naming a vendor.
