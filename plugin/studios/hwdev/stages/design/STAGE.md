---
name: design
description: Schematic, PCB layout, mechanical, and BOM
hats: [electrical-engineer, mechanical-engineer, pcb-designer, design-reviewer]
fix_hats: [classifier, electrical-engineer, pcb-designer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: inception
    discovery: discovery
  - stage: requirements
    discovery: functional-requirements
  - stage: requirements
    discovery: safety-analysis
---

# Design

Electrical schematic, PCB layout, mechanical enclosure, and bill of materials.
Every design decision must trace back to a requirement — unjustified
components add cost, unjustified features add risk. Component selection
matters: lead times, second sources, and end-of-life status are part of the
design contract, not an afterthought.

## Per-unit baton

Each design unit walks `plan → do → verify` across the hat list:

- **`electrical-engineer`** (plan / do for schematic + BOM) reads
  requirements, picks a topology, selects components, and produces the
  schematic + sourced BOM block for this slice of the product.
- **`mechanical-engineer`** (do for enclosure / thermal) develops the
  mechanical envelope, mounting, and thermal path that lives with the
  electrical artifact for this unit.
- **`pcb-designer`** (do for layout) translates the schematic into a
  manufacturable PCB layout that meets EMC, thermal, and mechanical
  constraints.
- **`design-reviewer`** (verify) integrates schematic, layout, mechanical,
  and BOM into one coherent review and either advances the unit or rejects
  back to the responsible hat.

Detailed process for each role lives in that hat's md file.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, electrical-engineer,
pcb-designer, feedback-assessor]` dispatches per finding — the classifier
routes; the electrical and PCB hats land the corrective edits depending on
whether the finding is schematic-scope or layout-scope; the assessor
independently decides closure. The gate is `[external, ask]` — design review
typically wants a real human signoff (engineering peer review, hardware
review board, or fab-house DFM signoff submitted via the team's chosen
review surface).

## Tooling

The plugin default is tool-agnostic. Concrete EDA / CAD / simulator / fab
commands and house conventions belong in a project overlay at
`.haiku/studios/hwdev/stages/design/`. The plugin defaults reference
artifact categories (schematic source, PCB source, mechanical CAD, BOM CSV,
Gerbers, drill, pick-and-place) without prescribing the tool that produces
them.
