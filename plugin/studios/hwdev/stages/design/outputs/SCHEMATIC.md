---
name: schematic
location: (whatever the project's EDA toolchain uses — schematic source files alongside any rendered export the team commits for review)
scope: repo
format: artifact
required: true
---

# Schematic

The complete electrical schematic, authored in the project's chosen EDA toolchain (schematic-capture suite). The schematic source — whatever file format the toolchain uses (`.sch`, `.kicad_sch`, code-defined `.tsx` / `.py` circuit source, etc.) — is the authoritative artifact. Any rendered preview (SVG / PDF) is a derived export. PCB layout and fabrication exports (Gerbers, drill, pick-and-place) are tracked separately under `outputs/PCB.md`.

## Content Guide

- **Schematic source committed** in whatever native format the project's EDA tool uses; reproducible from source by anyone with the toolchain installed
- **All nets named** where naming aids readability
- **All components** identified by manufacturer part number with rationale for non-obvious choices; symbols / footprints sourced from the project's chosen library system rather than ad-hoc
- **Power tree** documented (subcircuit grouping, comments, or a paired markdown sheet) showing regulation and decoupling strategy
- **Signal integrity** considered for any high-speed paths, with routing constraints captured wherever the toolchain expresses them (constraint files, PCB layer of the source)
- **Rendered schematic preview** (SVG / PDF) exported and committed for reviewers who aren't running the EDA tool

## Completion

Complete when ERC is clean in the EDA tool, the BOM (exported from the same source) is sourced with confirmed availability, committed manufacturing exports match the current source, and design review has signed off.

Project overlays at `.haiku/studios/hwdev/stages/design/outputs/` may add team-specific export commands, EDA-tool naming conventions, or fab-house metadata schemas without modifying this default.
