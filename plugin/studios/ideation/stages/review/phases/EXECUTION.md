# Review Stage — Execution

## Per-unit baton (`review-planner → synthesizer → reviewer → critic → fact-checker`)

The review stage runs a plan-do-verify front loop followed by an adversarial loop, per architecture §3.5. Every unit walks all five hats in order:

1. **`review-planner` (plan):** Names the in-scope aspects for THIS unit and the criterion + severity rubric per aspect. Hands off when every unit success criterion maps to at least one planned aspect and the rubric is specific enough that two reviewers would agree on a severity.
2. **`synthesizer` (do):** Performs the review per the plan. Produces one observation block per planned aspect with citations to specific draft anchors and severities drawn from the rubric. Hands off when no aspect is silently skipped and every FINDING includes a remediation suggestion.
3. **`reviewer` (verify):** Closes the front loop. Validates that every planned aspect has a substantive observation, citations are concrete, severities follow the rubric, and no scope drift occurred. Either advances or rejects to the responsible hat.
4. **`critic` (adversarial):** Finds what the front loop's aspect list didn't cover — missing perspectives, structural alternatives, steel-manned counterarguments, selection bias in evidence. Findings come with constructive alternatives, not just complaints.
5. **`fact-checker` (adversarial verify):** Terminal hat. Traces every load-bearing claim to its source and checks the trace for strengthened / weakened paraphrases, misattributions, and unsourced load-bearing claims. Surviving claims are trust-classed; tertiary-only load-bearing claims get filed as findings.

The front loop must close before the adversarial loop runs — this is the difference between an adversarial pass and a half-finished review. Critic and fact-checker assume the front loop already covered the planner's aspects rigorously; their value is in extending the coverage.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coherence` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coherence` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → synthesizer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `synthesizer` is the implementer (review-stage defects are usually missed observations against an aspect, not missed plans); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. A human typically arbitrates which findings the deliverable actually addresses before `deliver` runs — not every finding needs a fix; some are caveats the deliverable can ship with.

## Reviewer guidance specific to this stage

- **Silent skips of planned aspects** are the highest-priority finding class. If the planner listed an aspect and the synthesizer didn't produce an observation block for it, the review didn't happen.
- **Findings without draft citations** are second. "The argument is weak" without naming what in the argument is a finding the publisher can't act on.
- **Severity drift across units** is third. Comparable findings carrying different severities in different units is how the deliverable's fix priority gets unmoored from the actual defect severity.
- **Adversarial findings that duplicate front-loop findings** are fourth. If the critic or fact-checker just restates what the synthesizer already said, the adversarial loop added no value.
