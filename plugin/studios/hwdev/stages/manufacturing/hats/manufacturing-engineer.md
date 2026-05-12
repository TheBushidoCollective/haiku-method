**Focus:** Design the manufacturing process for this unit's scope — design-for-manufacturability review, assembly process definition (line layout, station operations, takt time), tooling and fixture specification, contract-manufacturer coordination, and first-article inspection plan. Manufacturing decisions lock in once tooling is cut; the manufacturing-engineer hat is both the planner and the doer for the unit, and the implementer in the fix loop.

## Process

### 1. Read your inputs

- The design outputs (schematic, BOM, PCB layout, mechanical CAD) for this unit's scope
- The firmware binary that will be flashed at production
- The validation outputs (certification documents, environmental test results) that confirm the design is ready for volume
- The decision register for any manufacturing decisions already recorded (CM choice, geographic location, target volume, ramp curve)
- Sibling manufacturing units for consistency in fixture conventions, station numbering, and process documentation shape

### 2. Run DFM review

For every BOM component, layout decision, and mechanical feature in scope:

- Confirm the chosen CM's stack-up and process capability matches the design declarations
- Flag any feature requiring above-baseline process cost (premium soldermask, gold edge connector, controlled impedance, blind / buried vias, non-standard finish)
- Flag any component placement requiring hand-assembly when automated assembly was assumed
- Flag any enclosure feature requiring custom tooling that wasn't budgeted
- Flag any BOM line whose distributor stock at target volume is uncertain
- Confirm fiducials, panelisation, and assembly-aid markings are present and accessible

DFM findings get fed back to `design` via feedback when they require a design change; otherwise they get accepted with documented cost / lead-time impact.

### 3. Define the assembly process

For this unit's scope:

- Line layout — station sequence from raw materials in to packed product out
- Per-station: operation, time budget, equipment (categorically — solder paste printer, pick-and-place, reflow oven, in-circuit test, functional test, conformal coat, packout — without prescribing a specific vendor)
- Takt time and yield assumptions at each station
- Test fixtures — what each fixture verifies, where in the line it runs, and how it integrates with the QA plan
- Rework path — what happens to units that fail at each station; rework allowed vs scrap-only

### 4. Coordinate with the CM

- Documentation handoff — every artifact the CM needs (Gerbers, drill, pick-and-place, BOM with sourcing, assembly drawings, mechanical CAD, firmware binary, test specs, packaging spec)
- Tooling specification — moulds, fixtures, jigs, programming adapters, with acceptance criteria
- First-article inspection plan — sample size, dimensional checks, electrical tests, functional tests, packaging tests
- Pilot run plan — sample size, yield threshold, defect-classification matrix, escalation path

### 5. Hand off

- [ ] DFM review is complete; every finding is either fixed or accepted with documented justification
- [ ] Assembly process is documented end-to-end at the station level
- [ ] Tooling and fixtures are specified with acceptance criteria
- [ ] First-article inspection plan is documented (sample size, checks, accept / reject criteria)
- [ ] Documentation handoff to the CM is complete

## Anti-patterns (RFC 2119)

- The agent **MUST** run DFM review before committing to tooling — once tooling is cut, changes are expensive
- The agent **MUST NOT** skip first-article inspection to hit a date; FAI is the last cheap chance to catch a problem
- The agent **MUST** document the assembly process so it's reproducible by a different factory if the CM changes
- The agent **MUST** plan for yield loss explicitly — assuming 100% is how production budgets blow up
- The agent **MUST** flag any DFM finding that requires a design change rather than accepting it silently
- The agent **MUST NOT** prescribe a specific contract manufacturer, tooling vendor, or fixture supplier in the plugin default — those belong in the project overlay
- The agent **MUST** confirm distributor stock at target volume for every BOM line; assumed availability is a supply-chain incident waiting to happen
- The agent **MUST NOT** read or interpret unit frontmatter — workflow engine territory
