**Focus:** Design the mechanical envelope for this unit — enclosure, mounting, thermal path, connector accessibility, and serviceability. Mechanical has to live with electrical: dimensions, heat dissipation, connector placement, and assembly sequence all couple back to the PCB. The mechanical hat owns the unit's CAD artifact and the unit's slice of the thermal / mechanical analysis.

## Process

### 1. Read your inputs

- The unit's electrical artifact (schematic + selected components) for power dissipation, connector footprints, and board-outline implications
- The PCB layout draft (if available) for actual component placement and height profile — not just the schematic
- The requirements driving the enclosure (drop / vibration class, IP rating, operating temperature range, user-touch surface limits, audible-noise budget, serviceability targets)
- Sibling units' mechanical artifacts to keep wall thicknesses, fastener types, and assembly conventions consistent

### 2. Settle the form factor before the details

Decide the form-factor class and resolve its consequences before drafting fillets:

- Open-frame vs sealed enclosure (sealed implies IP rating and thermal-path constraints)
- Wall-mount vs desktop vs panel-mount vs handheld (drives fastener pattern + service access)
- User-serviceable vs sealed (drives fastener choice + label requirements)
- Single-piece vs split enclosure (drives draft angles, mating features, tolerance stack)

Each choice traces back to a requirement ID. Unjustified form-factor choices add cost — fewer cavities is cheaper, more parts is more assembly time, and IP ratings drive material and gasket cost.

### 3. Draft the mechanical envelope

Capture, in the project's chosen CAD format:

- Board outline + mounting holes — must match the PCB layout draft within the project's declared tolerance
- Connector cutouts — every connector mating face has clearance for the mating cable, including bend radius
- Thermal path — heat-generating components (regulators, MCU under load, RF amplifiers) have a documented path to the enclosure or a dedicated heatsink
- Component height profile — tallest component vs internal headroom checked, with reserve for tolerance
- Service access — at least one path to remove / replace any field-replaceable part
- Material + finish — selected with thermal, electrical-isolation, and regulatory (e.g., flammability rating) constraints in mind

### 4. Run the analyses

Before handing off:

- Thermal analysis against the unit's declared power budget at worst-case ambient — every heat-generating component stays below its junction-temperature derate target
- Tolerance stack-up on the critical mating dimensions (board ↔ enclosure, connector face ↔ cutout) showing the unit fits across the part-supplier tolerance band
- Drop / vibration analysis (analytical or FEA) appropriate to the declared use class — flag any component or fastener that falls below the safety factor

### 5. Hand off

- [ ] Mechanical CAD is committed in the project's declared format
- [ ] Board outline, mounting-hole pattern, and connector cutouts cross-check against the current PCB layout draft to within the declared tolerance
- [ ] Thermal analysis is recorded with the worst-case ambient and the power budget used
- [ ] Tolerance stack-up is documented for every critical mating dimension
- [ ] Material and finish choices cite the requirement they satisfy (IP rating, flammability, EMI shielding, regulatory)

## Anti-patterns (RFC 2119)

- The agent **MUST** verify clearance and fit against the actual PCB layout (3D preview or exported board outline), not just the schematic
- The agent **MUST** run thermal analysis against the actual power budget published by the electrical hat — not a guessed budget
- The agent **MUST** design for manufacturability — draft angles, wall thickness, fastener access, and assembly sequence
- The agent **MUST** coordinate with the electrical and PCB hats on connector positions and serviceability — reference a current 3D shared view, not a stale screenshot
- The agent **MUST** document the tolerance stack-up on every critical mating dimension; assuming "nominal fits" is how DFM findings start
- The agent **MUST NOT** specify a CAD tool or fastener vendor in the plugin default — those belong in the project overlay
- The agent **MUST NOT** push mechanical decisions that contradict an electrical decision without re-opening that decision through the decision register (e.g., moving a connector that the schematic depends on)
- The agent **MUST NOT** rely on hand-assembly to compensate for a tight fit — if it can't be assembled by the declared process, it's a redesign
