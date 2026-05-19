# Firmware Stage — Execution

## Per-unit baton (`firmware-engineer → reviewer`)

Every firmware unit walks the two hats in order. The baton is the unit's accumulating artifact set on disk:

1. **`firmware-engineer` (plan / do):** Reads the unit's requirements + the schematic decisions that drive its peripherals, plans the deliverables (functions, modules, handlers), coordinates shared-resource ownership with sibling units, implements the code, writes the tests, and records the on-target measurements (flash / RAM / timing / power) that demonstrate the unit meets its requirements.
2. **`reviewer` (verify):** Reads the unit's source, tests, and measurements against the requirements, safety analysis, and resource budgets, and either advances the unit or rejects with the responsible hat named (which rewinds within this unit).

The hat order is `plan → do → verify`. The firmware-engineer hat does both plan and do because firmware planning is inseparable from coding decisions; the reviewer hat is the terminal verifier.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `resource-budget` and `safety-path-coverage` review agents and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `resource-budget` and `safety-path-coverage` review agents and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → firmware-engineer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `firmware-engineer` is the implementer (re-engineer lands the corrective edits and tests); the assessor independently decides closure.

6. **Gate** — The stage's gate is `[external, ask]`. Firmware shipping into a physical product typically wants peer-review signoff external to the agent loop (engineering peer review, safety review, or external code review through the team's chosen review surface).

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Safety-critical paths without fault-injection tests** is the single highest-priority finding. A mitigation that can't be exercised is unverified; an unverified mitigation that ships becomes a recall.
- **Resource overruns without headroom** are next. Firmware that fits at 99% today has nowhere to grow when a field defect needs a patch.
- **Mitigations assumed to be hardware-only when the schematic doesn't actually provide them** are a guaranteed cert / safety finding. Read both sides — firmware code AND schematic — before approving any mitigation.
- **Shared-resource conflicts** (two units claiming the same timer, DMA channel, interrupt priority) are silent ticking bombs. Confirm shared-resource ownership across all units before approving any one.
- **Tool prescription in the unit's code or tests** — pinning compilers, debuggers, or RTOSes in the unit content — is a project-overlay concern. The plugin defaults describe verification categories generically.
