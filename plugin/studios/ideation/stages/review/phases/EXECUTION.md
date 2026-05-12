# Review Stage — Execution

## Per-unit baton (`review-planner → synthesizer → reviewer → critic → fact-checker`)

The review stage runs a plan-do-verify front loop followed by an adversarial loop, per architecture §3.5. Every unit walks all five hats in order:

1. **`review-planner` (plan):** Names the in-scope aspects for THIS unit and the criterion + severity rubric per aspect. Hands off when every unit success criterion maps to at least one planned aspect and the rubric is specific enough that two reviewers would agree on a severity.
2. **`synthesizer` (do):** Performs the review per the plan. Produces one observation block per planned aspect with citations to specific draft anchors and severities drawn from the rubric. Hands off when no aspect is silently skipped and every FINDING includes a remediation suggestion.
3. **`reviewer` (verify):** Closes the front loop. Validates that every planned aspect has a substantive observation, citations are concrete, severities follow the rubric, and no scope drift occurred. Either advances or rejects to the responsible hat.
4. **`critic` (adversarial):** Finds what the front loop's aspect list didn't cover — missing perspectives, structural alternatives, steel-manned counterarguments, selection bias in evidence. Findings come with constructive alternatives, not just complaints.
5. **`fact-checker` (adversarial verify):** Terminal hat. Traces every load-bearing claim to its source and checks the trace for strengthened / weakened paraphrases, misattributions, and unsourced load-bearing claims. Surviving claims are trust-classed; tertiary-only load-bearing claims get filed as findings.

The front loop must close before the adversarial loop runs — this is the difference between an adversarial pass and a half-finished review. Critic and fact-checker assume the front loop already covered the planner's aspects rigorously; their value is in extending the coverage.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — Stage review agents (`coherence`) and studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, synthesizer, feedback-assessor]` dispatches per finding. `synthesizer` is the implementer because review-stage defects are usually missed observations against an aspect, not missed plans; if a finding's root cause is a missed aspect entirely, route it back to `review-planner` via the unit body and the next iteration re-plans.
4. **Gate** — `ask`. A human typically arbitrates which findings the deliverable actually addresses before `deliver` runs — not every finding needs a fix; some are caveats the deliverable can ship with.

## Reviewer guidance specific to this stage

- **Silent skips of planned aspects** are the highest-priority finding class. If the planner listed an aspect and the synthesizer didn't produce an observation block for it, the review didn't happen.
- **Findings without draft citations** are second. "The argument is weak" without naming what in the argument is a finding the publisher can't act on.
- **Severity drift across units** is third. Comparable findings carrying different severities in different units is how the deliverable's fix priority gets unmoored from the actual defect severity.
- **Adversarial findings that duplicate front-loop findings** are fourth. If the critic or fact-checker just restates what the synthesizer already said, the adversarial loop added no value.
