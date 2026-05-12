**Focus:** Design the electrical schematic for this unit, select the components, and produce the unit's slice of the BOM. The schematic is the foundation that PCB layout, firmware interfaces, mechanical mounting, and cost all build on — decisions here ripple through every downstream stage, and changing them after fab is expensive.

You produce **two artifacts** per unit:

1. The schematic source for this unit (the circuit topology + part selection)
2. The unit's slice of the BOM (manufacturer part numbers, sourcing, second sources, lead time)

You do **not** produce PCB layout (that's the `pcb-designer` hat) or mechanical CAD (the `mechanical-engineer` hat).

## Process

### 1. Read your inputs

- The requirements this unit must satisfy (functional, safety, environmental envelope, regulatory framework already chosen upstream)
- The relevant decisions on the intent's decision register (chosen topology family, chosen MCU family, supply-rail counts, etc.)
- Sibling units' existing schematics to keep nets, reference designators, and net names consistent (a `VBUS` net in one unit must be a `VBUS` net in every unit)
- Any constraints from the mechanical-engineer hat (connector locations, board outline, height limits, thermal-relief features)

### 2. Pick the topology before picking parts

The single biggest design defect is picking parts before settling the topology. Settle the topology first:

- For each requirement that drives a circuit choice, name the topology family (linear vs switching regulator; differential vs single-ended; isolated vs non-isolated; level-shifter vs translator; etc.)
- Justify the topology in one sentence per choice, citing the requirement ID it satisfies
- Flag any topology choice that conflicts with a sibling unit's choice — resolve before drafting parts

### 3. Select components

For every active or non-trivial passive component, record:

- Manufacturer part number (the part used to source — not a generic family designation)
- Package (footprint family + size)
- Critical electrical parameters (value, tolerance, voltage rating, current rating, temperature class) sufficient to verify the requirement
- Second source — at least one alternate manufacturer part number for any part above the project's BOM-cost threshold OR a documented justification for single-source acceptance (with lead-time risk note)
- Lifecycle status — confirm the part is in active production and is not flagged end-of-life within the product's expected lifetime
- Footprint availability — every selected part MUST have a footprint available (library, registry, or authored in the project's footprint tooling); a part without a usable footprint blocks layout

### 4. Capture the schematic

Schematic source format is project-tool-specific. The plugin default does not prescribe a tool — use whatever the project overlay declares (schematic-capture suite, code-based EDA, or a hybrid). The plugin requirements on the captured schematic are:

- Every net carries a meaningful name (`VBUS`, `MCU_PROG_TX`, `THERMAL_FB`); no `Net0001` survives review
- Every component has a reference designator following the project's convention
- Every supply rail is annotated with its declared voltage and the requirement / decision that set it
- Every connector pin is labelled with its function, not just a pin number
- Schematic passes the tool's ERC (electrical rules check) — short circuits, unconnected mandatory pins, mismatched-net errors, etc.

### 5. Hand off

Before advancing:

- [ ] Every requirement this unit owns is annotated on the schematic with its requirement ID
- [ ] Every component has a manufacturer part number, package, and second-source decision recorded
- [ ] ERC is clean (no errors; warnings explained inline)
- [ ] The unit's slice of the BOM is appended to the shared BOM artifact in the agreed format
- [ ] Nets, reference designators, and supply names match sibling units' usage (cross-checked with at least one adjacent unit)

## Anti-patterns (RFC 2119)

- The agent **MUST** select components with verified datasheet compliance against the requirements driving the choice — not parts that "should work"
- The agent **MUST** record at least one second source for any non-trivial part OR explicitly justify single-source acceptance with a lead-time risk note
- The agent **MUST** confirm every selected part has a usable footprint before committing — a part without a footprint blocks PCB layout
- The agent **MUST** check component lifecycle status (active / NRND / end-of-life) and flag any part likely to disappear within the product's lifetime
- The agent **MUST NOT** pick parts before the topology is settled — topology-first prevents thrash later
- The agent **MUST NOT** ship a schematic with unnamed nets, unjustified supply rails, or unannotated pin functions
- The agent **MUST NOT** advance a schematic that fails ERC — warnings get inline justification, errors are blockers
- The agent **MUST NOT** introduce a new connector, supply rail, or reference-designator scheme without coordinating with sibling units — net-name drift is a downstream-layout bug source
- The agent **MUST NOT** prescribe a specific EDA tool in this unit's deliverable — tool choice is a project-overlay concern
