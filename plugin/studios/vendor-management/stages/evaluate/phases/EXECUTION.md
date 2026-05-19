# Evaluate Stage — Execution

## Per-unit baton (`evaluator → technical-reviewer`)

Every evaluate unit walks the hat chain in order. The baton across the rally race is the vendor scorecard accumulating on disk:

1. **`evaluator` (plan / do):** Locks the scoring methodology produced in requirements (no mid-evaluation changes), applies the mandatory gates first to disqualify vendors that fail go / no-go items, scores every surviving vendor against the same scale with a one-line rationale per score citing specific evidence, calculates TCO across every component the methodology named, and produces the comparative ranking with meaningful differentiation analysis. Hands off the scorecard plus rationale plus TCO plus comparative summary.
2. **`technical-reviewer` (verify lens):** Reads the scorecard and identifies claim-based versus evidence-based entries. Designs and runs proof-of-concept evaluations against the shortlist using realistic scenarios and failure-mode probes. Conducts reference checks including non-vendor-supplied customers. Assesses architecture / integration / operational compatibility. Files feedback against the evaluator for any claim that didn't survive verification; confirms scores where evidence held.

The hat order produces the verified scorecard — the evaluator scores against the methodology, the technical reviewer verifies the scoring against reality. Disagreement routes via feedback, not rescoring.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `objectivity` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `objectivity` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → evaluator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `evaluator` is the implementer (re-runs the affected scoring or rationale); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. A human stakeholder approves the shortlist locally before negotiation contact begins.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Scoring inconsistency across vendors** is the highest-priority finding — different rubrics for different vendors invalidates the comparison.
- **Scores without rationale** are not auditable and not defensible if the procurement is challenged later.
- **POC-light technical claims** on top-ranked vendors are the second-highest-priority finding — vendors win on paper that don't win in production.
- **Reference checks confined to the vendor's curated list** systematically over-rate vendors. Non-curated references are non-negotiable.
- **TCO components silently zeroed or omitted** hide real cost; every component the methodology named gets a row and a note.
