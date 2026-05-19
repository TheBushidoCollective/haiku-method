# Evaluate Stage — Execution

## Per-unit baton (`evaluator → analyst → verifier`)

Every evaluate unit walks the three hats in order. The baton is `EFFECTIVENESS-REPORT.md` accumulating from designed instruments and raw data, through analysis and finding, to verified artifact:

1. **`evaluator` (plan / do):** Reads the delivery log, the curriculum plan, and the original needs assessment for this unit. Chooses the Kirkpatrick levels appropriate to the outcome question (reaction / learning / behavior / results). Designs the instruments — Level 1 survey, Level 2 pre/post assessment paired with objectives, Level 3 observation or behavior measure with lag time aligned to the behavior's stabilization cycle, Level 4 metric tied to the original gap. Plans sampling (size, strategy, stratification, control / comparison where possible). Pilots instruments before full administration. Collects the data, tracks non-response, captures stakeholder synthesis (learner, manager, subject-matter input). Hands off when the data set is collected and documented with anomalies flagged.

2. **`analyst` (do):** Validates data quality (completeness, integrity, construct validity, baseline comparability) before running analysis. Chooses analytical methods that match the question and data (difference of means with effect size, difference of proportions, time-series, subgroup analysis, qualitative coding). Confronts confounders explicitly (concurrent interventions, selection effects, maturation, testing effects, regression to the mean, Hawthorne effects). Labels every finding as correlation or causation. Maps every finding back to a specific gap from the needs assessment. Produces prioritized improvement recommendations grounded in the data. Hands off when findings are reported honestly with effect sizes and confounder treatment.

3. **`verifier` (verify):** Reads the unit body. Validates substance (no placeholders, every finding has data behind it), citation (every numerical claim has a source), internal consistency (the recommendations follow from the findings), decision-register consistency, and open-question accountability. Either advances or rejects to the responsible hat.

The hat order is `plan → do → verify` because the evaluator's instruments and data are the spec the analyst interprets, and the interpretation is what the verifier validates.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → evaluator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `evaluator` is the implementer (re-authors the work); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The user approves the findings locally before they feed back into the next program iteration, because incorrect causal claims here distort every downstream decision.

## Reviewer guidance specific to this stage

- **A Level-1-only evaluation when the question asked about behavior or results** is the highest-priority finding. Satisfaction is not evidence of learning, transfer, or outcome change.
- **A correlation labeled as causation** is the second-highest. The confounder treatment is what separates a defensible recommendation from a confidently wrong one.
- **A significance test reported without effect size** is a reporting finding — significance without practical magnitude is rarely actionable.
- **A finding that doesn't trace back to a specific gap from the needs assessment** is a scope finding — findings without questions become recommendations without grounding.
- **A null or negative finding buried in an appendix while positives lead the report** is an honesty finding — null findings are often the most useful signal for the next iteration.
- **A recommendation that rests on the evaluator's prior beliefs rather than the data** is a grounding finding — recommendations must cite the evidence that supports them.
