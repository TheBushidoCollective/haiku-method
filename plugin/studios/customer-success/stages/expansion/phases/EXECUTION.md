# Expansion Stage — Execution

## Per-unit baton (`growth-strategist → value-consultant → verifier`)

Every expansion unit walks the three hats in order. The baton across the rally race is the unit's `OPPORTUNITY-BRIEF.md` accumulating on disk:

1. **`growth-strategist` (plan):** Reads the upstream `HEALTH-REPORT.md` and the intent's decision register. Confirms the account is healthy enough to expand. Names the specific expansion path (product, module, capacity tier, segment), runs the five-question qualification with cited evidence, addresses contract / budget timing, sizes the opportunity as a range with named assumptions, and declares the kill-signal.
2. **`value-consultant` (do):** Reads the strategist's qualification half and the cited customer-side data sources. Builds the ROI model with sourced rows and a stated confidence band, writes one narrative per required stakeholder with headline / first concern / proof / ask, lays out the phased adoption plan with rollback conditions, and restates the kill-signal with its early indicator.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the strategist establishes whether the path is qualified before the consultant invests in a business case. Inverting it produces beautiful ROI models for paths that should never have advanced.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the stage's artifacts conform.
2. **Quality review (parallel)** — The stage's `opportunity-validity` review agent and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → growth-strategist → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB; `growth-strategist` is the implementer (re-qualifying the path or revising the business-case constraints); the assessor independently decides closure.
4. **Gate** — The stage's gate is `[ask, await]`. The user picks between approving locally (`ask`) or waiting for an external event (`await`, e.g., a customer response to the proposal) before the workflow advances to `renewal`.

## Reviewer guidance specific to this stage

- **Expansion against an at-risk account without explicit mitigation** is the single highest-priority finding. Expanding into unhealth accelerates churn in the account the team is trying to grow.
- **Missing kill-signal** is next. A path with no condition under which it would be disqualified is wishful thinking, regardless of how strong the rest of the case looks.
- **Single narrative for multi-stakeholder audiences** is style drift that lowers conversion — economic and technical buyers have different decision criteria and need different framings.
