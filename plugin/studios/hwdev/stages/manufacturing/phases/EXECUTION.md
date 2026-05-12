# Manufacturing Stage — Execution

## Per-unit baton (`manufacturing-engineer → qa-lead → verifier`)

Every manufacturing unit walks the three hats in order. The baton is the unit's accumulating operational specification on disk:

1. **`manufacturing-engineer` (plan / do):** Reads the design outputs (schematic, BOM, PCB source, mechanical CAD), the firmware binary that will be flashed at production, and the validation outputs that confirm the design is ready for volume. Runs the DFM review, lands the disposition for every finding (fix / accept / mitigate), specifies the operational procedure (preconditions, action, post-condition check, rollback / scrap policy), and plans first-article inspection and ramp gates. Hands off when the procedure body is complete and tooling / fixtures are specified with acceptance criteria.
2. **`qa-lead` (do):** Reads the manufacturing-engineer's procedure and the functional / safety requirements the unit must defend. Sharpens each post-condition check into a quantitative acceptance contract (instrument, threshold, sample size, accept/reject rule), enumerates the defect taxonomy with severity classes, declares escalation thresholds for defect rates, and specifies the traceability fields that persist per unit. Hands off when every post-condition check has a quantitative criterion and the defect / traceability shape is recorded.
3. **`verifier` (verify):** Reads the operational specification against the stage's body-level criteria — preconditions stated, action unambiguous, post-condition mechanically decidable with audit-trail evidence, rollback / scrap policy declared where applicable — and either advances the unit or rejects with the responsible hat named (which rewinds within this unit).

The hat order is `plan → do → verify`. The manufacturing-engineer hat owns the procedure shape because process correctness is upstream of quality criteria; the qa-lead hat sharpens that shape into a measurable contract; the verifier is the terminal validator on the body.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The engine-built spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`dfm-readiness`, `quality-plan`) and any studio-level review agents fire in parallel. Each files feedback if its lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → manufacturing-engineer → feedback-assessor`) dispatches against each open feedback. The classifier routes; the manufacturing-engineer lands the corrective edits to the procedure or the quality plan; the assessor independently decides closure. Findings that diagnose a design defect are raised against `design` rather than fixed in place.
4. **Gate** — The stage's gate is `await` — manufacturing readiness typically depends on an external event (CM signoff on tooling, first-article inspection pass, pilot run yield reaching threshold, certified-lab return) rather than a synchronous review. Discrete-mode intents pause here until the external event arrives.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **DFM findings without dispositions** is the single highest-priority finding. A finding marked "noted" with no fix / accept / mitigate decision is the line about to surprise the team at FAI.
- **Acceptance criteria stated subjectively** is next. "Looks correct" is not a contract; an instrument + threshold + sample size + accept/reject rule is.
- **End-of-line tests that miss a documented safety mitigation** are guaranteed cert / safety findings. The fault-injection seam the firmware-engineer published has to be exercised on every unit, not on a sample.
- **Single-source BOM lines accepted without a lead-time risk note** are supply-chain incidents waiting to happen.
- **Tool prescription in the procedure** — pinning a specific CM, MES, or fixture vendor in the unit content — is a project-overlay concern. The plugin defaults describe categories (SMT line, ICT fixture, end-of-line functional fixture, dimensional gauge) without naming a vendor.
