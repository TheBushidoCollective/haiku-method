# Design Stage — Elaboration

Design is a **design / synthesis** stage. Its units are designed components or option sets that compose into the full hardware solution — schematics, PCB layout sections, mechanical sub-assemblies, BOM blocks. Each unit produces one designed artifact that downstream stages (`firmware`, `manufacturing`, `validation`) consume as input.

## What a unit IS in this stage

One designed component, sub-assembly, or option set. Examples:

- "Power supply schematic — input range, regulation topology, protection"
- "MCU subsystem — pinout, decoupling, programming interface"
- "Connector and IO layout — shielding, ESD, mating cycles"
- "Enclosure mechanical — material, mounting, thermal relief"
- "BOM cost & second-source plan — single-source risks called out, lead times"
- "PCB stackup and impedance plan — layer count, controlled-impedance traces"

What a unit is **NOT** in this stage:

- ❌ A research question about the market or user (those belong in `inception`)
- ❌ An execution-spec for firmware code (`firmware`'s own elaborate phase authors those)
- ❌ A test procedure (those are `validation`-stage units)
- ❌ A manufacturing process step (those are `manufacturing`-stage units)

If you find yourself writing executable verify-commands or a Gherkin scenario, you're authoring the wrong stage's units. Stop and route the work downstream.

## What "completion criteria" means here

Design-artifact criteria are about **substance, traceability, and coherence**, not executability. Each criterion should be checkable by a designer reading the artifact, not by a shell command.

### Good criteria — substantive and checkable

- "Every component on the schematic has a part number, package, value, and tolerance — no `???` or `TBD`"
- "Every design choice that depends on a requirement cites the requirement ID (e.g., REQ-FN-04, REQ-SAFE-12)"
- "BOM lists ≥1 second source for every part above $1 BOM cost OR explicitly justifies single-source with a lead-time risk note"
- "Power budget table sums to ≤ declared input budget with ≥10% margin"
- "Mechanical CAD references the same connector footprints as the PCB layout — connector locations match within 0.5mm"

### Bad criteria — vague or wrong-stage language

- ❌ "Design is complete" (tautological; complete by what measure?)
- ❌ "Schematic looks reasonable" (no concrete check)
- ❌ "Tests pass" — there's nothing to test in design; testability is a `validation`-stage concern
- ❌ "Code compiles" — wrong stage entirely

## How verification happens

Design artifacts are validated by the verify-class hat declared in `STAGE.md` (currently `design-reviewer`). The verifier checks **substance, traceability to requirements, internal coherence across components, and decision-register accountability** — body-content checks only, no frontmatter interpretation.

## Anti-patterns

- **Mixing design and execution.** A unit titled "Implement ADC firmware driver" belongs in `firmware`, not `design`. Keep design at the spec level.
- **Single-document syndrome.** A 40-page master design doc with 9 sections defeats the per-unit model — each section can't be revisited or rejected independently. One designed component per unit.
- **Skipping requirement traceability.** Design choices without requirement citations are how scope creep enters; the verifier rejects them.
