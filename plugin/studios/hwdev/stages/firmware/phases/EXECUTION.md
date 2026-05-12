# Firmware Stage — Execution

## Per-unit baton (`firmware-engineer → reviewer`)

Every firmware unit walks the two hats in order. The baton is the unit's accumulating artifact set on disk:

1. **`firmware-engineer` (plan / do):** Reads the unit's requirements + the schematic decisions that drive its peripherals, plans the deliverables (functions, modules, handlers), coordinates shared-resource ownership with sibling units, implements the code, writes the tests, and records the on-target measurements (flash / RAM / timing / power) that demonstrate the unit meets its requirements.
2. **`reviewer` (verify):** Reads the unit's source, tests, and measurements against the requirements, safety analysis, and resource budgets, and either advances the unit or rejects with the responsible hat named (which rewinds within this unit).

The hat order is `plan → do → verify`. The firmware-engineer hat does both plan and do because firmware planning is inseparable from coding decisions; the reviewer hat is the terminal verifier.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The engine-built spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`resource-budget`, `safety-path-coverage`) and any studio-level review agents fire in parallel. Each files feedback if its lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → firmware-engineer → feedback-assessor`) dispatches against each open feedback. The classifier routes; the firmware-engineer lands the corrective edits and tests; the assessor independently decides closure.
4. **Gate** — The stage's gate is `[external, ask]` — firmware shipping into a physical product typically wants peer-review signoff external to the agent loop (engineering peer review, safety review, or external code review through the team's chosen review surface).

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Safety-critical paths without fault-injection tests** is the single highest-priority finding. A mitigation that can't be exercised is unverified; an unverified mitigation that ships becomes a recall.
- **Resource overruns without headroom** are next. Firmware that fits at 99% today has nowhere to grow when a field defect needs a patch.
- **Mitigations assumed to be hardware-only when the schematic doesn't actually provide them** are a guaranteed cert / safety finding. Read both sides — firmware code AND schematic — before approving any mitigation.
- **Shared-resource conflicts** (two units claiming the same timer, DMA channel, interrupt priority) are silent ticking bombs. Confirm shared-resource ownership across all units before approving any one.
- **Tool prescription in the unit's code or tests** — pinning compilers, debuggers, or RTOSes in the unit content — is a project-overlay concern. The plugin defaults describe verification categories generically.
