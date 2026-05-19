# Health Check Stage — Execution

## Per-unit baton (`health-monitor → risk-analyst → verifier`)

Every health-check unit walks the three hats in order. The baton across the rally race is the unit's `HEALTH-REPORT.md` accumulating on disk:

1. **`health-monitor` (plan):** Reads the upstream `USAGE-REPORT.md` and external account signals (support, sentiment, stakeholder access, contract, executive interactions). Produces the scorecard half: at least five dimensions rated with cited evidence, every dimension showing trend vs. prior period, silent signals rated `unknown` (yellow-minimum). Writes a holistic read that identifies which dimensions dominate, then hands off focus dimensions and access gaps to the analyst.
2. **`risk-analyst` (do):** Reads the scorecard and the handoff. Separates leading from lagging indicators, ranks each risk by severity and reversibility (separately, not collapsed), writes mitigation plans for every medium- or high-severity risk with named owner role, success criterion, and escalation path. Surfaces the single highest-priority risk explicitly as the baton into expansion.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the monitor reads the multi-dimensional picture before the analyst commits to specific risks and mitigations. Inverting it produces analysts hunting risks against a picture that has not yet been read.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `risk-accuracy` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `risk-accuracy` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → health-monitor → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `health-monitor` is the implementer (re-rating a dimension or re-evidencing a score); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The user reviews the health read and risk plan and approves locally before the workflow advances to `expansion`.

## Reviewer guidance specific to this stage

- **A silent account rated green** is the single highest-priority finding. No signal is not the same as good signal; downstream stages treat green as a precondition for expansion, and a mis-rated green directly causes growth into churn.
- **A chronic risk re-declared as new** is the next-highest. A risk that was open in the prior cycle and hasn't closed is not a fresh discovery — calling it new hides organizational drift.
- **Mitigation owned by "the team"** instead of a named role compounds into mitigations that don't get done.
