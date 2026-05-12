---
name: firmware
description: Embedded software for the hardware platform
hats: [firmware-engineer, reviewer]
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

Each firmware unit walks `plan → do → verify`:

- **`firmware-engineer`** (plan / do) reads the requirements + the
  schematic (for peripherals, pin assignments, supply rails) and lands
  the code, tests, and on-target measurements for this unit's scope.
- **`reviewer`** (verify) checks the unit against functional
  requirements, safety analysis, and memory / flash / power budgets;
  advances or rejects with the failed criterion named.

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
