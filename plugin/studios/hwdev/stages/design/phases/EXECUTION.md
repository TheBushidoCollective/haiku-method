# Design Stage — Execution

## Per-unit baton (`electrical-engineer → mechanical-engineer → pcb-designer → design-reviewer`)

Every design unit walks the four hats in order. The baton across the rally race is the unit's own integrated artifact set accumulating on disk:

1. **`electrical-engineer` (plan / do for schematic + BOM):** Reads the unit's requirements, settles topology, selects components, and produces the schematic + the unit's BOM slice. Hands off when the schematic is ERC-clean, every component has a part number and second-source decision, and every requirement is annotated with the artifact element that satisfies it.
2. **`mechanical-engineer` (do for enclosure / thermal):** Reads the schematic + PCB layout draft, develops the enclosure / mounting / thermal path that lives with this unit's electrical artifact, and runs the analyses (thermal, tolerance, drop). Hands off when mechanical CAD cross-checks against the layout draft within tolerance and the analyses are recorded.
3. **`pcb-designer` (do for PCB layout):** Reads the schematic + mechanical envelope and translates them into a manufacturable PCB layout. Hands off when DRC is clean, return paths and impedance-controlled signals are documented, fab capability is confirmed, and fabrication exports regenerate identically from source.
4. **`design-reviewer` (verify):** Reads the integrated artifact set against the requirements and decision register, and either advances the unit or rejects with the responsible hat named (which rewinds within this unit).

The hat order is `plan → do → verify` because the electrical hat publishes the foundation, the mechanical and PCB hats build on it in parallel where the geometry allows but serially when the layout needs the mechanical envelope (and vice versa), and the design-reviewer integrates the artifact set as a whole.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The engine-built spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`compliance-mapping`, `manufacturability`) and any studio-level review agents fire in parallel. Each files feedback if its lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain dispatches against each open feedback in order: the classifier routes the finding; the electrical-engineer or pcb-designer hat lands the corrective edits depending on whether the finding is schematic-scope or layout-scope; the assessor independently decides closure.
4. **Gate** — The stage's gate is `[external, ask]` — the user may submit the design package for external review (engineering peer review, hardware review board, fab-house DFM signoff in the team's review surface) or approve locally. Approval signals the stage is done and the workflow moves on.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Source ↔ export drift** is the single highest-priority finding. Committed fabrication exports that don't regenerate identically from source mean a reviewer cannot tell which is canonical; a manufacturer building from the exports will diverge from what the design tool says.
- **Requirement orphans** — a requirement the unit claimed to satisfy with no artifact citation — are next. Orphans become cert findings or field failures.
- **Single-source acceptance without lead-time risk note** is a guaranteed supply-chain incident when the part stocks out.
- **Layout decisions that contradict the mechanical CAD** (connector position, board outline, mounting holes) block the next stage and produce real-world fit failures.
- **Tool prescription** — telling reviewers to use a specific EDA / CAD vendor in unit content — is a project-overlay concern. The plugin default keeps the structure of the artifact set generic; the overlay shapes it for the specific team's tooling.
