# Discovery Stage — Execution

## Per-unit baton (`market-explorer → competitive-analyst → verifier`)

Every discovery unit walks the three hats in order. The baton across the rally race is the unit body accumulating evidence and structure:

1. **`market-explorer` (plan / breadth):** Reads the unit's framing (segments, adjacencies, time horizon agreed during elaboration), surveys the landscape, and writes the landscape findings into the unit body with citations and a hand-off note for the competitive-analyst.
2. **`competitive-analyst` (do / depth):** Reads the landscape and the hand-off note. Builds the positioning view across direct competitors, substitutes, and emerging entrants; names the opportunity space (underserved positions, substitution risk, convergence risk). Appends the positioning map, the named opportunity space, and the risks.
3. **`verifier` (verify):** Reads the unit body and validates substance, citation chain, internal consistency, and decision-register accountability. Advances if the artifact holds together; rejects with a specific named criterion otherwise. Rejection routes back to the responsible hat within the unit.

The hat order is `plan → do → verify` because the landscape view is what the competitive-analyst's positioning work depends on; a thin landscape produces a thin positioning view, and the verifier checks both.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the discovery artifacts conform.
2. **Quality review (parallel)** — The stage's `thoroughness` review agent fires alongside any studio-level review agents. Each produces feedback if its lens identifies a finding.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, market-explorer, feedback-assessor]` dispatches per finding. The classifier routes the FB; the market-explorer re-authors the affected slice; the assessor independently decides closure.
4. **Gate** — `auto`. The downstream user-research stage's elaborate phase is where the user re-engages with the output, so the discovery gate does not require human approval to advance.

## Reviewer guidance specific to this stage

- **Unsourced market numbers** are the single highest-priority finding. They propagate through every downstream stage and corrode the strategy's credibility once stakeholders notice.
- **Missing emerging entrants** are next — the team's blind spot in discovery becomes the surprise competitor in stakeholder review.
- **A positioning map with no named opportunity space** is unfinished work, not a stylistic preference.
- **Editorial framing of competitor strengths and weaknesses** (rather than evidence-grounded gaps relative to user needs) signals analysis that won't survive stakeholder pressure.
