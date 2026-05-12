# Health Check Stage — Execution

## Per-unit baton (`health-monitor → risk-analyst → verifier`)

Every health-check unit walks the three hats in order. The baton across the rally race is the unit's `HEALTH-REPORT.md` accumulating on disk:

1. **`health-monitor` (plan):** Reads the upstream `USAGE-REPORT.md` and external account signals (support, sentiment, stakeholder access, contract, executive interactions). Produces the scorecard half: at least five dimensions rated with cited evidence, every dimension showing trend vs. prior period, silent signals rated `unknown` (yellow-minimum). Writes a holistic read that identifies which dimensions dominate, then hands off focus dimensions and access gaps to the analyst.
2. **`risk-analyst` (do):** Reads the scorecard and the handoff. Separates leading from lagging indicators, ranks each risk by severity and reversibility (separately, not collapsed), writes mitigation plans for every medium- or high-severity risk with named owner role, success criterion, and escalation path. Surfaces the single highest-priority risk explicitly as the baton into expansion.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the monitor reads the multi-dimensional picture before the analyst commits to specific risks and mitigations. Inverting it produces analysts hunting risks against a picture that has not yet been read.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the stage's artifacts conform.
2. **Quality review (parallel)** — The stage's `risk-accuracy` review agent and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → health-monitor → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB; `health-monitor` is the implementer (re-rating a dimension or re-evidencing a score); the assessor independently decides closure.
4. **Gate** — The stage's gate is `ask`. The user reviews the health read and risk plan and approves locally before the workflow advances to `expansion`.

## Reviewer guidance specific to this stage

- **A silent account rated green** is the single highest-priority finding. No signal is not the same as good signal; downstream stages treat green as a precondition for expansion, and a mis-rated green directly causes growth into churn.
- **A chronic risk re-declared as new** is the next-highest. A risk that was open in the prior cycle and hasn't closed is not a fresh discovery — calling it new hides organizational drift.
- **Mitigation owned by "the team"** instead of a named role compounds into mitigations that don't get done.
