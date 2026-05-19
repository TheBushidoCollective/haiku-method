# Discovery Stage — Execution

## Per-unit baton (`market-explorer → competitive-analyst → verifier`)

Every discovery unit walks the three hats in order. The baton across the rally race is the unit body accumulating evidence and structure:

1. **`market-explorer` (plan / breadth):** Reads the unit's framing (segments, adjacencies, time horizon agreed during elaboration), surveys the landscape, and writes the landscape findings into the unit body with citations and a hand-off note for the competitive-analyst.
2. **`competitive-analyst` (do / depth):** Reads the landscape and the hand-off note. Builds the positioning view across direct competitors, substitutes, and emerging entrants; names the opportunity space (underserved positions, substitution risk, convergence risk). Appends the positioning map, the named opportunity space, and the risks.
3. **`verifier` (verify):** Reads the unit body and validates substance, citation chain, internal consistency, and decision-register accountability. Advances if the artifact holds together; rejects with a specific named criterion otherwise. Rejection routes back to the responsible hat within the unit.

The hat order is `plan → do → verify` because the landscape view is what the competitive-analyst's positioning work depends on; a thin landscape produces a thin positioning view, and the verifier checks both.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `thoroughness` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `thoroughness` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → market-explorer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `market-explorer` is the implementer (re-authors the affected slice); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. The downstream user-research stage's elaborate phase is where the user re-engages with the output, so the discovery gate does not require human approval to advance.

## Reviewer guidance specific to this stage

- **Unsourced market numbers** are the single highest-priority finding. They propagate through every downstream stage and corrode the strategy's credibility once stakeholders notice.
- **Missing emerging entrants** are next — the team's blind spot in discovery becomes the surprise competitor in stakeholder review.
- **A positioning map with no named opportunity space** is unfinished work, not a stylistic preference.
- **Editorial framing of competitor strengths and weaknesses** (rather than evidence-grounded gaps relative to user needs) signals analysis that won't survive stakeholder pressure.
