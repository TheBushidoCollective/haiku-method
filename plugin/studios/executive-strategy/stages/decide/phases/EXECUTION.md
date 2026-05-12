# Decide Stage — Execution

## Per-unit baton (`advisor → facilitator → verifier`)

Every decide unit walks the three hats in order:

1. **`advisor` (plan):** Reads the evaluation report and risk analysis. Drafts the recommendation with a stated tie-breaker, the strongest case for, the strongest case against (in the form a serious opponent would make it), acknowledged risks (mitigated / unmitigated / watch-item), and the operational handoff (first actions, owners, next decision point). Hands off when the brief presents a position a decision-maker can ratify or reject.
2. **`facilitator` (do):** Reads the advisor's draft. Identifies actual decision-makers vs. contributors vs. informed-only. Runs the decision conversation in real or asynchronous form, captures dissents in the dissenter's own framing, documents the deliberation chain, and produces the decision record (decision, deciders by name and role, date, forum, rationale, dissents, conditions, reversal triggers). Hands off when the decision record is complete and operational handoff is confirmed.
3. **`verifier` (verify):** Reads the unit body. Checks preconditions, the decision action, post-condition verification, rollback (where applicable), and decision-register consistency per the body-only mandate. Either advances or rejects.

The hat order is `plan → do → verify` because the recommendation must be coherent and risk-honest BEFORE the deliberation; otherwise the facilitator is running a conversation around a half-formed position.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `transparency` review agent fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, advisor, feedback-assessor]` dispatches per finding. The classifier routes the FB. `advisor` is the implementer (re-drafting the recommendation, strengthening the counterargument response, or re-stating risks more prominently). The assessor independently decides closure.
4. **Gate** — The stage's gate is `external` — the brief goes out for external ratification (board / investment committee / executive sign-off). The workflow blocks until the external decision system signals approval (typically branch merge in the project's tracking system, or explicit external acknowledgement).

## Reviewer guidance specific to this stage

- **Strawmanned counterargument** is the highest-priority finding — an evaluation that gets a polite, soft objection back from the advisor signals the recommendation wasn't engaged honestly with the risk analysis.
- **Buried risks** — a body that reads as triumphant with an appendix carrying the real exposure tries to slide unmitigated risk past the decision-maker. Re-surface in the body or file the finding.
- **Paraphrased dissents** — dissents that appear smoothed ("some members expressed reservations") instead of in the dissenter's own framing have been laundered.
- **Anonymous deciders** — "the team decided", "leadership approved" without named individuals creates a decision the organization can't hold anyone accountable for.
- **Missing reversal triggers** — a decision without named reversal triggers can't be detected as failing; flag the absence as a finding.
- **Missing operational handoff** — a recommendation that ends without first actions, owners, and next decision point is incomplete regardless of how good the analysis was.
