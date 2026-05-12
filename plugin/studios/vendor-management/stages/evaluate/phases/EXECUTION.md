# Evaluate Stage — Execution

## Per-unit baton (`evaluator → technical-reviewer`)

Every evaluate unit walks the hat chain in order. The baton across the rally race is the vendor scorecard accumulating on disk:

1. **`evaluator` (plan / do):** Locks the scoring methodology produced in requirements (no mid-evaluation changes), applies the mandatory gates first to disqualify vendors that fail go / no-go items, scores every surviving vendor against the same scale with a one-line rationale per score citing specific evidence, calculates TCO across every component the methodology named, and produces the comparative ranking with meaningful differentiation analysis. Hands off the scorecard plus rationale plus TCO plus comparative summary.
2. **`technical-reviewer` (verify lens):** Reads the scorecard and identifies claim-based versus evidence-based entries. Designs and runs proof-of-concept evaluations against the shortlist using realistic scenarios and failure-mode probes. Conducts reference checks including non-vendor-supplied customers. Assesses architecture / integration / operational compatibility. Files feedback against the evaluator for any claim that didn't survive verification; confirms scores where evidence held.

The hat order produces the verified scorecard — the evaluator scores against the methodology, the technical reviewer verifies the scoring against reality. Disagreement routes via feedback, not rescoring.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate; the built-in spec-conformance subagent confirms the scorecard conforms to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`objectivity`) and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → evaluator → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB; the evaluator re-runs the affected scoring or rationale; the assessor independently decides closure.
4. **Gate** — The stage's gate is `ask` — a human stakeholder approves the shortlist locally before negotiation contact begins.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Scoring inconsistency across vendors** is the highest-priority finding — different rubrics for different vendors invalidates the comparison.
- **Scores without rationale** are not auditable and not defensible if the procurement is challenged later.
- **POC-light technical claims** on top-ranked vendors are the second-highest-priority finding — vendors win on paper that don't win in production.
- **Reference checks confined to the vendor's curated list** systematically over-rate vendors. Non-curated references are non-negotiable.
- **TCO components silently zeroed or omitted** hide real cost; every component the methodology named gets a row and a note.
