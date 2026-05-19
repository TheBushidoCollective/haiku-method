# Measure Stage — Execution

## Per-unit baton (`analyst → report-writer → verifier`)

Every measure unit walks the three hats in order. The baton is the measurement artifact this unit owns — analytic findings turned into a stakeholder-ready narrative:

1. **`analyst` (plan + do):** Reads the campaign log, the strategy's goals and KPIs, and the strategy's segment definitions. Compares actuals to targets, segments performance across channel category / audience / asset, attributes drivers, surfaces anomalies. Hands off when every goal has a variance row with confidence, every significant outcome has named drivers AND counter-evidence considered, and underperformance is reported as honestly as outperformance.
2. **`report-writer` (do — synthesis):** Turns the analyst's findings into a three-layer stakeholder report — executive summary, narrative findings, prioritized recommendations. Carries confidence and caveats forward; introduces no new claims or numbers. Hands off when every recommendation traces to a specific finding, quick wins and strategic shifts are separated, and mutually exclusive recommendations are marked.
3. **`verifier` (verify):** Reads the unit body and runs the substance / verifiability / decision-register / open-questions checks from `hats/verifier.md`. Advances on pass, rejects to the responsible hat on fail.

The hat order is `plan → do → verify` because the analyst produces the evidence base, the report-writer synthesizes it into the stakeholder narrative, and the verifier confirms substance and traceability. The rally-race test (architecture §2.3) is met because the baton (raw segmented data → narrative report → validated report) is meaningfully transformed at each handoff.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `methodology` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `methodology` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `analyst` is the implementer (re-applies on the next iteration); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. The measurement artifact is a knowledge output, not a customer-facing publication; the reflection step is where humans engage with the conclusions and decide what carries into the next campaign.

## Reviewer guidance specific to this stage

- **KPIs in the report that don't appear in the strategy's KPI definitions** are the highest-priority finding. Silent KPI redefinition turns the measurement story into a different campaign's story.
- **Attribution claims with no named model** corrupt every recommendation built on them. Treat as a hard block.
- **Confident conclusions drawn from underpowered slices** are how next campaigns over-invest in patterns that weren't real. The methodology lens exists specifically to catch this; if a cut's sample size doesn't support the confident claim, flag it.
- **Recommendations untraceable to specific findings** are generic best-practice advice masquerading as data-backed decisions — the most common drift in this stage.
- **Underperformance buried or omitted** is the failure mode that compounds across campaigns. A report that frames every result as a win has more value as a flag of writer behavior than as a measurement artifact.
