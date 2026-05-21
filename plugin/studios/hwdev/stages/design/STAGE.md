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

Produce the physical design of the hardware: electrical schematic, PCB layout, mechanical enclosure, and bill of materials. Every decision here traces back to a requirement — unjustified components add cost, unjustified features add risk — and component sourcing is part of the contract, not an afterthought.

## Scope

The design artifacts against the requirements: schematic, sourced BOM, mechanical envelope and thermal path, and a manufacturable PCB layout. Design decides *how the product is engineered to meet its requirements* — not what the requirements are (requirements) and not how it's built at volume (manufacturing).

## What to do

- Trace every design decision back to a requirement; if nothing requires a component or feature, it doesn't belong.
- Select components with lead time, second sources, and end-of-life status treated as design constraints.
- Make the layout manufacturable — meeting EMC, thermal, and mechanical constraints, not just electrically correct.
- Integrate schematic, layout, mechanical, and BOM into one coherent design that holds together as a whole.

## What NOT to do

- Don't change or reinterpret the requirements to make the design easier — a wrong requirement is a revisit upstream.
- Don't define the assembly process or production ramp — that's manufacturing.
- Don't add an unjustified component or feature that no requirement calls for.
- Don't treat sourcing risk (long lead times, single-source, EOL parts) as someone else's problem to discover later.
