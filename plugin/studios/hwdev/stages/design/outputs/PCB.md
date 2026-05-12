---
name: pcb-layout
location: (project's PCB source in whatever native format the EDA toolchain uses; fabrication exports — Gerbers / drill / pick-and-place — committed alongside)
scope: repo
format: artifact
required: true
---

# PCB Layout & Fabrication Files

The PCB layout source — placement, routing, board outline, layer stack-up, mounting holes, and copper pours — committed in whatever native format the project's EDA toolchain uses. The fabrication exports (Gerbers, drill, pick-and-place) are derived artifacts: regenerated from source on every layout change and committed alongside it so reviewers and fab houses don't need to run the toolchain.

## Content Guide

- **PCB source** in the project's chosen format — placement, routing, board outline, layer stack-up, mounting holes, copper pours
- **DRC-clean** in the EDA toolchain before exports are regenerated
- **Gerbers** (one set per layer per fab order)
- **Drill files** (plated and non-plated)
- **Pick-and-place** (centroid + rotation per reference designator)
- **Stack-up document** with fab-house capability cross-checked
- **Fabrication notes** for any non-default process (controlled impedance, blind/buried vias, surface finish requirements)

## Quality Signals

- DRC is clean in the EDA toolchain
- Committed Gerbers / drill / pick-and-place regenerate identically from the current PCB source — drift between source and exports is a hard fail
- Stack-up and trace widths are within the target fab house's published capability
- Mounting holes, connector positions, and board outline align with the mechanical 3D preview

Project overlays at `.haiku/studios/hwdev/stages/design/outputs/` may add team-specific export commands, EDA-tool conventions, or fab-house deliverable formats without modifying this default.
