**Focus:** Translate this unit's schematic into a manufacturable PCB layout that meets electrical, mechanical, thermal, and EMC requirements. PCB layout is where the electrical design meets physical reality — routing, return paths, copper geometry, and stack-up choices determine whether the product actually performs the way the schematic implies.

You produce **one artifact** per unit: the PCB layout source for this unit's circuit slice, plus the regenerable fabrication exports (Gerbers, drill, pick-and-place) that downstream stages consume.

## Process

### 1. Read your inputs

- The completed schematic for this unit (ERC-clean, components selected, footprints assigned)
- The mechanical envelope draft (board outline, mounting holes, connector cutouts, height profile) — your layout has to fit
- Sibling units' layout drafts to keep stack-up, layer assignments, and impedance targets consistent across the whole board
- Requirements driving layout decisions — high-speed signaling rules, EMC class, isolation gaps, current capacities, thermal-relief targets

### 2. Settle the stack-up and the placement plan

Before routing:

- Confirm the stack-up — layer count, dielectric thicknesses, copper weights, impedance-controlled layers, and which fab capabilities the project assumes. Cross-check against the project's chosen fab house's published capability sheet.
- Plan placement zones for: high-speed clocks, switching regulators, sensitive analog, connectors, mechanical interfaces (mounting holes, indicator LEDs, user-facing controls). Each zone gets a one-line rationale.
- Confirm the placement plan with the mechanical hat — connector positions, mounting holes, and height restrictions go in BEFORE general routing.

### 3. Place, then route

- Place high-pin-count parts first (BGAs, large QFNs, large connectors); they have the least placement freedom
- Place decoupling near the pin it serves; do not route decoupling caps to the next-nearest via
- Route in priority order: critical signals first (high-speed, sensitive analog, high-current power), then general signals, then aesthetics
- Maintain return-path integrity — every signal trace has a known reference plane underneath; layer changes route a return-stitching via near the signal via
- Respect declared isolation gaps (creepage, clearance, working voltage); regulatory isolation requirements take precedence over routing convenience

### 4. Run the rules

The layout MUST pass:

- DRC (design rules check) — no clearance violations, no manufacturing-violation widths, no unconnected nets that should be connected
- EMC heuristics — no broken return paths, no high-speed traces over plane splits, no antenna-shaped open stubs
- Thermal-relief checks — power-component pads have appropriate copper area, thermal vias where the analysis demanded
- Fab capability check — stack-up, minimum trace / space, drill sizes, copper weights, soldermask and silkscreen choices all within the declared fab's capabilities

### 5. Export and commit

Regenerate the fabrication exports from the layout source on every change:

- Gerbers (one set per copper, soldermask, silkscreen, mechanical layer)
- Drill files (plated and non-plated, separated)
- Pick-and-place (centroid + rotation per reference designator)
- Stack-up document showing the as-fabricated structure

Commit the layout source AND the regenerated exports together. If exports drift from source between commits, the next reviewer cannot tell which is correct.

### 6. Hand off

- [ ] Stack-up matches the project's declared fab capability
- [ ] DRC passes in the layout tool, with no errors and warnings explained inline
- [ ] Critical signals have documented return paths and impedance-controlled routing where required
- [ ] Mechanical cross-check is current: board outline, mounting holes, connector positions, and height profile match the mechanical CAD draft
- [ ] Fabrication exports are regenerated from the current source and committed alongside

## Anti-patterns (RFC 2119)

- The agent **MUST** pass DRC in the layout tool before considering layout complete; warnings get inline justification, errors are blockers
- The agent **MUST** design with EMC in mind — ground planes, return paths, careful routing of high-speed and switching signals
- The agent **MUST** coordinate with the mechanical hat on outline, mounting holes, and connector positions using a current 3D shared reference, not a stale screenshot
- The agent **MUST** verify the chosen fab house can actually produce the stack-up, trace widths, and drill sizes the layout declares
- The agent **MUST** regenerate fabrication exports (Gerbers, drill, pick-and-place) from source on every layout change — committed exports that drift from source are a red flag and a manufacturability hazard
- The agent **MUST NOT** prescribe a specific PCB-layout tool in the plugin default — tool choice is a project-overlay concern
- The agent **MUST NOT** prioritize aesthetic routing over electrical correctness (return paths, impedance, decoupling proximity)
- The agent **MUST NOT** layer-jump a high-speed signal without a return-stitching via nearby
- The agent **MUST NOT** declare a layout complete without confirming the unit's slice integrates cleanly with sibling units' layout slices on the shared board
