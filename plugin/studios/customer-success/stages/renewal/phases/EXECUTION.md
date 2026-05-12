# Renewal Stage — Execution

## Per-unit baton (`renewal-manager → executive-sponsor → verifier`)

Every renewal unit walks the three hats in order. The baton across the rally race is the unit's `RENEWAL-STRATEGY.md` accumulating on disk:

1. **`renewal-manager` (plan):** Reads the upstream `OPPORTUNITY-BRIEF.md`, the most recent `HEALTH-REPORT.md`, and the original sales context. Builds the value-realization narrative with cited customer-side data. Prepares responses for the four standard objection categories (price, competitive, scope, timing) plus account-specific ones. Sets concession boundaries (open offer, acceptable counter, walk-away, escalation owner) per lever. Sequences the renewal motion by dependency. Hands off to the executive sponsor with the audience, the forward beats, and the touch type.
2. **`executive-sponsor` (do):** Reads the manager's strategy and the customer's publicly stated priorities. Confirms the executive audience (primary, secondary, briefing-only), builds the three-beat forward narrative (partnership so far, shift ahead, commitment), tailors per-executive framing (headline / strategic frame / concern / proof point), names the touch type with rationale, and positions the touch inside the renewal motion rather than alongside it.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the operational strategy must be in place before the executive narrative is layered on top. Inverting it produces executive engagement that's untethered from the motion and becomes the problem instead of the lever.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the stage's artifacts conform.
2. **Quality review (parallel)** — The stage's `risk-assessment` review agent and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → renewal-manager → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB; `renewal-manager` is the implementer (re-framing the narrative or re-sequencing the negotiation); the assessor independently decides closure.
4. **Gate** — The stage's gate is `[external, await]`. The strategy is submitted for external sign-off (commercial / legal approval inside the user's organization) and then waits for the customer-side renewal-event signal before the workflow finalizes.

## Reviewer guidance specific to this stage

- **A value claim the customer would dispute** is the single highest-priority finding. Once the customer rejects the narrative's foundation, every downstream concession is recalibrated.
- **Concession boundaries stated as ranges with no escalation owner** is the next-highest. Without a named owner the boundary is improvisation, and improvisation under pressure loses margin.
- **An executive narrative any senior CSM could deliver** is style drift that wastes the executive touch — the value of the touch is the commitment no one else can make.
