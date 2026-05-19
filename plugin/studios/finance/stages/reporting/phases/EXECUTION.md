# Reporting Stage — Execution

## Per-unit baton (`reporter → visualizer → verifier`)

Every reporting unit walks the three hats in `plan → do → verify` order:

1. **`reporter` (plan):** Identifies the unit's audience (executive / departmental / finance-partner / external) and confirms with the user where ambiguous. Picks the structure that fits the audience and stays in it. Writes the narrative — each material number paired with one to two sentences of context citing the upstream source. Includes required disclosures and forward-looking commentary anchored to the forecast. Hands off when every number ties back to its source artifact via explicit reference.
2. **`visualizer` (do):** Reads the narrative. For each chart, states the question it answers, picks the chart type from the data relationship (not from visual preference), defines scales and reference lines, applies consistent formatting across the dashboard (color, label, number, date), and designs the drill-down path from summary to detail. Sanity-checks for distortion patterns (truncated axes, exaggerated aspect ratios, color-only favorable / unfavorable signals).
3. **`verifier` (verify):** Reads the unit body. Validates substance, source traceability, internal consistency, and decision-register alignment.

The hat order is `plan → do → verify` because the reporter's audience and structure decisions determine what the visualizer must support; verifier checks the result against substance criteria, not against the audience choice itself.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `clarity` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `clarity` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → reporter → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `reporter` is the implementer (re-authors the affected section); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Reports are stakeholder-facing; a local human reviews tone, accuracy, and disclosure completeness before close.

## Reviewer guidance specific to this stage

- **A truncated y-axis on a bar or stacked chart** is the canonical misleading-chart pattern and the highest-priority visual-integrity finding.
- **One report serving multiple audiences** is the highest-priority structural finding — overwhelms executives, under-informs analysts.
- **A number in narrative without a tie-back to its source artifact** breaks the traceability the close stage depends on.
- **Lagging-only indicators with no forward-looking commentary** make the report incomplete; even a brief forecast-anchored paragraph closes the gap.
- **Restated comparatives without an explanation of what changed** misleads year-over-year reading.
