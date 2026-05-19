---
interpretation: lens
---
**Mandate:** The agent **MUST** be the user's eyes for the hardware design stage — render every committed design artifact (schematic source, PCB layout, 3D mechanical, Gerber set, BOM) through a real browser and judge it the way a reviewer cracking open the project for the first time would. The hwdev studio is intentionally tool-neutral: whether the project uses KiCad, tscircuit, atopile, or any other EDA toolchain, the rendered preview in the browser is the single common surface. Verify the visual output, not the file metadata. Screenshots of what gets rendered ARE the proof that the design holds up.

## Check

Open a view session via `haiku_view({ stage: "design" })` and use the bundled `playwright` MCP to navigate to each design artifact through the SPA's artifact-browser route. The SPA dispatches `.kicad_sch` / `.kicad_pcb` to KiCanvas, `.gbr` / `.drl` to Tracespace, `.glb` / `.gltf` to `<model-viewer>`, and `.tsx` circuit code to tscircuit's renderer. Call `browser_take_screenshot` for each artifact you assert on. **Save each screenshot** to disk under `.haiku/intents/<intent>/stages/design/proof/<artifact-slug>-<view>.png` using the `Write` tool. Attach screenshots to every finding.

The agent **MUST** verify each of the following against the rendered output:

- **Schematic renders cleanly.** No ERC errors visible in KiCanvas (or the equivalent renderer) overlay. Every component symbol resolves (no broken-link placeholders). Power and ground nets are visibly distinct from signal nets. The schematic fits on the rendered canvas without overflow.
- **All named nets are labeled and traceable.** The nets the spec / requirements document called out by name (typically: power rails, clock signals, key data lines, debug pads) appear in the rendered schematic with their names visible. Walk each named net visually — if it disappears off-canvas or terminates at a pin without a label that matches the spec, that's a finding.
- **PCB layout matches the schematic.** Render the PCB through KiCanvas (or equivalent). Every component on the schematic has a corresponding footprint on the board. Board outline matches the mechanical dimensions the design spec declared. Mounting holes are positioned where the mechanical 3D specifies. No DRC errors visible in the rendered overlay.
- **Gerber set is complete and self-consistent.** Render the Gerber/drill set through Tracespace. Every committed layer renders without parse errors. Layer count matches the stack-up document. The board outline visible in Gerbers matches the PCB source. Plated vs non-plated drills are distinguishable. Pick-and-place centroids align with the rendered footprints.
- **3D mechanical preview agrees with the PCB.** Render the `.glb` / `.gltf` through `<model-viewer>`. Mounting holes, connector positions, and overall board outline match what the PCB shows. Component clearances visible in 3D (off-board connectors, tall caps near enclosure walls) don't conflict with the mechanical envelope the spec declared.
- **BOM is sourced.** The committed BOM lists every component on the schematic with a manufacturer part number; spot-check a few against the rendered schematic to verify they match. A line item with `TBD` or `(unknown)` in the part number is a finding — the design isn't complete until every part is sourceable.
- **Per-unit claims hold.** Read every design unit body (`stages/design/units/<unit>.md`). Each unit's claimed deliverable — a particular subcircuit, a specific layout decision, a named power-supply topology — MUST be visible in the rendered artifacts. A unit that promised "shipped USB-C power input with ESD protection" but whose rendered schematic shows USB-C with no ESD diodes is a finding even when the unit ticked all its boxes mid-build.
- **Close the session.** Call `haiku_view_close({ session_id })` after all checks complete.

## Common failure modes to look for

- Schematic that compiles in the EDA tool but renders with broken-link placeholders because the symbol library reference was renamed and never updated
- A named net the spec called out (e.g. `VBUS_DET`) that's present in the netlist but no label appears in the rendered schematic, making the design unreviewable
- PCB layout where the board outline silently drifted off the mechanical dimensions because someone resized the keep-out and forgot the outline followed
- Gerber set committed with one layer accidentally exported at a different alignment than the rest — visible as a misregistered overlay in Tracespace, invisible in the EDA tool
- 3D model still showing the previous revision's connector position even though the PCB moved — committed STEP file went stale
- A BOM line `R12, R13: 10kΩ 0603 TBD` — the resistance and footprint are spec'd but no part number, no supplier, no availability — the design is not shippable to a fab
- A unit body that says "added decoupling caps to every IC" but the rendered schematic still has bare power pins on one of the ICs
