# Hardware Requirements Stage — Elaboration

Hardware requirements is a **research / specification** stage. Its units are knowledge topics capturing functional, safety, and regulatory requirements. Requirements drive every downstream stage — design, firmware, manufacturing, validation. Defects here cascade into PCB redesigns, certification failures, and recalls. Be strict.

This stage straddles research (gather and synthesize requirements) and specification (formalize them into testable obligations). Each unit is one requirement domain, not one feature.

## What a unit IS in this stage

One requirement domain. Examples:
- "Functional requirements: power management"
- "Functional requirements: connectivity (Wi-Fi/BLE/wired)"
- "Safety requirements: thermal management"
- "Safety requirements: overcurrent and short-circuit protection"
- "Regulatory: FCC Part 15B emissions framework and applicability evidence"
- "Regulatory: CE LVD and RED applicability"
- "Environmental requirements: operating range, ingress protection, vibration"
- "Reliability requirements: MTBF target and failure-mode analysis approach"

What a unit is **NOT** in this stage:
- ❌ A schematic, BOM, or PCB layout (those belong in `design`)
- ❌ Firmware code or bring-up procedures (those belong in `firmware`)
- ❌ Manufacturing process specs (those belong in `manufacturing`)
- ❌ A test plan execution (those belong in `validation` — but the requirements DO specify what must be testable)

## What "completion criteria" means here

Requirements are **testable obligations**, not executable code. Criteria here describe what must be specified for downstream stages to verify against.

### Good criteria — substantive and checkable

- "Functional §2 lists every functional requirement with a measurable outcome (e.g., 'powers on within 500ms of switch press', 'connects to a known SSID within 5s of cold boot')"
- "Safety §3 lists every hazard with: failure mode, mitigation, and fail-safe behavior — no hazard without all three"
- "Regulatory §4 names the framework (e.g., 'FCC Part 15B'), cites the specific CFR or EN section, and provides applicability evidence (product class, deployment region, intended use)"
- "Each requirement has a verification approach (test type: unit / system / regulatory / field) so downstream `validation` can author the test"
- "Open questions: regulatory open questions MUST default to `(needs human escalation)` — agents do not have authority to defer regulatory framework decisions"

### Bad criteria — vague or wrong-stage language

- ❌ "Product is safe" (no specific hazard, no mitigation, no fail-safe)
- ❌ "Compliant with applicable regulations" (which? cite them)
- ❌ "Each unit has 3-5 verify-commands" (build-stage language; requirements don't have shell commands)
- ❌ "Schematic implements the requirements" (wrong stage; design owns the schematic)

## Anti-patterns

- **Soft regulatory language.** "We'll figure out FCC later" is a hard reject. Regulatory frameworks cannot be retrofitted; pre-design lock-in is the whole point of this stage.
- **Functional-safety contradictions.** A "high-throughput mode that bypasses overcurrent" is a contradiction; the mitigation exists to enforce safety. Reconcile or escalate.
- **Drifting into design.** "Use the XYZ chipset" is a design decision, not a requirement. Requirements describe what must be true; design picks how to achieve it.

> Note on the universal FSM_CONTRACTS_ELABORATE_BLOCK: the orchestrator currently injects build-class rules (`depends_on:` cycles, executable `quality_gates:`, criteria-with-verify-commands) into every elaborate dispatch. Those rules are correct for build-class stages but do not apply to this stage's requirement-spec units (which are testable obligations, not executable artifacts). Treat the build-class rules as defaults the framework hasn't yet split — author your units to the substance/testability shape above. (Architecture §7 known issue tracking the split.)
