# Adoption Stage — Execution

## Per-unit baton (`adoption-coach → usage-analyst → verifier`)

Every adoption unit walks the three hats in order. The baton across the rally race is the unit's `USAGE-REPORT.md` accumulating on disk:

1. **`adoption-coach` (plan):** Reads the upstream `ONBOARDING-REPORT.md` and any prior usage signals. Names the specific adoption play (feature, workflow, persona, segment), writes the outcome chain tied to a cited business outcome, sequences the enablement, and declares the four targets the analyst will measure (baseline, target, leading indicator, anti-metric).
2. **`usage-analyst` (do):** Reads the coach's declared targets. Instruments and measures each one with the same definition, window, and segment the coach declared. Produces the measurement table with baseline / current / target / gap, at least one segmentation cut that points at the bottleneck, and an interpretation paragraph that describes what the data shows without prescribing the next play.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the coach declares what to measure and the analyst measures it. Swapping the order would have the analyst inventing targets — which is how adoption metrics drift toward what's convenient instead of what matters.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the stage's artifacts conform.
2. **Quality review (parallel)** — The stage's `effectiveness` review agent and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → adoption-coach → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB to the right unit or stage; `adoption-coach` is the implementer (re-authoring the play or the targets); the assessor independently decides closure.
4. **Gate** — The stage's gate is `auto`. Once the verifier has signed off and review is clean, the workflow advances to `health-check` without a human checkpoint.

## Reviewer guidance specific to this stage

- **Targets and measurements that don't match** is the single highest-priority finding. They are the same contract in two roles — if the coach declared one metric and the analyst measured another, downstream decisions get made against drifted numbers.
- **Anti-metric silently omitted** is the next-highest. A play that hits its target while its anti-metric blows up is not a green play.
- **Vanity metrics** (logins, page views) appearing in the measurement table when the coach declared workflow-completion metrics is style drift that compounds into renewal-time disputes.
