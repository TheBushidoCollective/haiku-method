# Prioritization Stage — Execution

## Per-unit baton (`prioritizer → stakeholder-proxy → verifier`)

Every prioritization unit walks the three hats in order. The baton across the rally race is the unit body accumulating scores, then pressure-test results:

1. **`prioritizer` (plan / score):** Chooses the framework (RICE, ICE, MoSCoW, weighted scoring, or another the team uses) during elaboration. Scores every opportunity in scope consistently, cites evidence per score, flags confidence honestly, writes per-decision "because" notes, and produces an explicit deprioritization list.
2. **`stakeholder-proxy` (do / pressure-test):** Enumerates the stakeholder groups (business, engineering, sales, support, finance, leadership), walks the ranking from each perspective, and documents concerns with severity (blocker / constraint / consideration) and at least one mitigation each. Recommends concrete revisions if any blockers surfaced.
3. **`verifier` (verify):** Validates the artifact body-only — framework applied consistently, evidence per score, confidence honest, stakeholder concerns named, deprioritization list explicit. Advances or rejects with a named criterion.

The hat order is `plan → do → verify` because pressure-testing assumes a complete scoring view to pressure-test against, and the verifier checks both the scoring and the pressure-test together.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `rigor` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `rigor` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → prioritizer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `prioritizer` is the implementer (re-scores against the gap); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Prioritization is the decision point where the user can no longer defer trade-offs, so the human review is load-bearing before the roadmap stage starts spending capacity against the order.

## Reviewer guidance specific to this stage

- **Inconsistent framework application** is the highest-priority finding — a single quietly-changed scoring rule mid-list undermines every ranking decision built on top of it.
- **High Impact scores with no citation back to user-research insights** signal scoring from internal preference, not evidence.
- **Confidence column missing or uniformly "high"** indicates false precision is hiding low-signal estimates.
- **No deprioritization list, or a list of items nobody wanted anyway**, is the most common source of stakeholder pushback after the roadmap ships — the trade-offs were not actually made visible.
