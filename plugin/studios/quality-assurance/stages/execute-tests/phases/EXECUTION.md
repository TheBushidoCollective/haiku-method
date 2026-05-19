# Execute Tests Stage — Execution

## Per-unit baton (`tester → reporter → verifier`)

Every execute-tests unit walks the three hats in order. The baton is the unit body accumulating from executed-results to results-plus-defects-plus-metrics to validated record:

1. **`tester` (plan / do for execution):** Confirms environment fidelity against the strategy, runs the cases as written, captures evidence for every result, records BLOCKED and SKIPPED cases with explicit reasons, retests after fixes. Hands off when every case in the slice has a result and an evidence reference.
2. **`reporter` (do for defects + metrics):** Writes defect entries for every failure with full reproduction context, collapses duplicates against sibling-unit entries, records execution-progress metrics with explicit numerators / denominators, fills the coverage-vs-exit-criteria section. Hands off when every failure traces to a defect entry and metrics are per-slice complete.
3. **`verifier` (verify):** Validates substance — body matches the spec it claims to satisfy, results have evidence, defects are properly categorized, exit-criteria coverage is honest. Advances or rejects to the responsible hat. Does not edit the unit.

The hat order is `plan → do → verify` because execution is the do, defect logging plus metrics is the do continuation, and validation is the verify.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → tester → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `tester` is the implementer (re-runs cases); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Verifier and review-agent lens are the certification; the workflow engine advances on pass.

## Reviewer guidance specific to this stage

- **Evidence gaps are the highest-priority finding.** A PASS without evidence is unverifiable; downstream stages cannot trust it.
- **Vague BLOCKED reasons** are next — they cost the next reviewer follow-up time and obscure systemic environment issues.
- **Duplicate defects** become triage tax in the analyze stage; collapse them here.
- **Severity / category drift** breaks the analyze stage's pattern analysis — flag and correct here.
- **Aggregate-only metrics** hide slices that aren't progressing; require per-slice breakdown.
