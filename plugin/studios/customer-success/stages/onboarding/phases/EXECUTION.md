# Onboarding Stage — Execution

## Per-unit baton (`onboarding-lead → technical-enabler → verifier`)

Every onboarding unit walks the three hats in order. The baton across the rally race is the unit's `ONBOARDING-REPORT.md` accumulating on disk:

1. **`onboarding-lead` (plan):** Reads the sales handoff (contract, stakeholders, commitments, deal context) and the unit's own success criteria. Defines initial value in a single sentence with an observable workflow outcome. Names every stakeholder role (or marks `unknown — to discover`), sequences milestones in dependency order with owners on both sides, and surfaces every sales commitment as covered, uncovered, or to-be-renegotiated.
2. **`technical-enabler` (do):** Reads the milestone plan. Inventories the integration surface with direction, auth, data shape, and failure mode per surface. Executes configuration with a run book that records what / why / reversal / validation per decision, runs end-to-end validation per integration surface (input → path → expected → actual → pass/fail), and lists edge cases the adoption team will hit.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the lead defines initial value and the technical scope it demands before the enabler configures anything. Inverting it produces a configured product the customer paid for but doesn't experience the outcome of.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the stage's artifacts conform.
2. **Quality review (parallel)** — The stage's `completeness` review agent and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → onboarding-lead → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB; `onboarding-lead` is the implementer (re-defining a milestone or re-sequencing the plan); the assessor independently decides closure.
4. **Gate** — The stage's gate is `ask`. The user reviews the onboarding plan and validates readiness before the workflow advances to `adoption`.

## Reviewer guidance specific to this stage

- **An "initial value" definition that's actually a feature-enablement event in disguise** is the single highest-priority finding. Configuring a feature is not the same as the customer experiencing the workflow outcome the feature enables.
- **Uncovered sales commitments quietly dropped** is the next-highest. Every uncovered promise is a first-renewal dispute waiting to happen.
- **An integration marked "validated" with only the credentials-test step run** compounds into adoption-stage failures that look unexplained because the gap was hidden in onboarding.
