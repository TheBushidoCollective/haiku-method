# Validation Stage — Execution

## Per-unit baton (`test-engineer → compliance-officer → validation-lead → verifier`)

Every validation unit walks the four hats in order. The baton is the unit's accumulating evidence set on disk:

1. **`test-engineer` (do for non-regulatory surfaces):** Reads the functional requirements and safety analysis the unit must verify, plus the build identifiers (schematic, BOM, firmware binary, mechanical CAD) the run will exercise. Picks the right test class for the surface (functional / HIL, environmental, reliability / accelerated-life, EMC pre-screen, functional-regression), builds the rig on production-representative hardware, runs the plan at sufficient sample size, and records evidence with build / firmware / mechanical / calibration identifiers. Hands off when every requirement and hazard in scope has a run record with raw measurement values and a recorded result.
2. **`compliance-officer` (do for regulatory surfaces):** Reads the regulatory frameworks the unit's surface is responsible for, pre-screens against the cert scope at internal capability, prepares the cert submission package (technical file, declared standards, intended use, labels and markings), books the certified-lab slot, manages the submission and feedback cycle, and lands the returned cert evidence. Operates in parallel with the test-engineer where the surfaces are distinct; does not handle non-regulatory test execution.
3. **`validation-lead` (do for the integrated decision):** Reads the test-engineer's run records and the compliance-officer's cert evidence. Builds the per-requirement and per-hazard coverage map citing the recorded evidence, populates the residual-risk register for any non-clean-pass finding (block / conditional / mitigation with rationale), and states an explicit release-readiness recommendation. Routes findings that diagnose a design / firmware / manufacturing defect to the responsible upstream stage via feedback rather than fixing in place.
4. **`verifier` (verify):** Reads each verification-surface unit against the stage's body-level criteria — scoped boundary, declared method / threshold / evidence shape, mechanical pass/fail criteria — and either advances the unit or rejects with the responsible hat named.

The hat order is `plan → do → verify`. The test-engineer and compliance-officer run in parallel where their surfaces are distinct (HIL test vs cert package); the validation-lead's coverage map cannot land until their evidence exists to cite; the verifier is the terminal validator on the body.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The engine-built spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`coverage`, `cert-completion`) and any studio-level review agents fire in parallel. Each files feedback if its lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → test-engineer → feedback-assessor`) dispatches against each open feedback. The classifier routes; the test-engineer lands corrective test-plan edits, runs additional coverage, or sharpens evidence shape; the assessor independently decides closure. Findings that diagnose upstream defects (design, firmware, manufacturing) are raised against the responsible stage rather than papered over in validation.
4. **Gate** — The stage's gate is `await` — validation completion typically blocks on an external event (certified-lab return, environmental-chamber slot finishing, third-party HALT lab result, field-trial cohort reporting) rather than a synchronous review. Discrete-mode intents pause here until the external event arrives.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Requirements or hazards without recorded coverage** is the single highest-priority finding. A coverage map missing a row is silent acceptance of the worst kind — the gap will reappear as a regulatory finding, a field failure, or a recall scope.
- **Mitigations exercised only via the happy path** are guaranteed safety findings. A fail-safe that has never been triggered is unverified, regardless of how many normal-operation runs pass.
- **Cert scope that does not match the manufacturing variant** is a shipment blocker. A cert for the prototype variant does not cover a production variant with a different antenna, enclosure, or firmware build.
- **Preliminary lab findings treated as formal sign-off** is a launch-slip risk. Formal cert decisions arrive in writing; verbal "looks good" indications do not unblock manufacturing ramp.
- **Failures followed by silent retests** indicate a broken validation discipline. A failure followed by a passing retest needs a root-cause record between, not just a second-run pass.
- **Tool prescription in the unit content** — pinning a specific certified lab, instrument vendor, or chamber make in the plugin default — is a project-overlay concern. The plugin defaults describe test categories generically (HIL rig, environmental chamber, EMC pre-screen capability, certified lab, oscilloscope, dimensional gauge) without naming a vendor.
