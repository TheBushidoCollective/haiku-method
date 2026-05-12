# Mitigate Stage — Execution

## Per-unit baton (`mitigator → verifier`)

Every mitigate unit walks the two hats in order. The baton across the rally race is the unit's slice of `MITIGATION-LOG.md` accumulating on disk:

1. **`mitigator` (plan + do):** Reads the working root-cause hypothesis from the investigate stage. Chooses the fastest reversible action (rollback / flag flip / scale / drain / config rollback), documents the exact change before applying it, names the rollback procedure for the mitigation itself, announces the action in the incident channel, applies the change, and records pre-apply and apply timestamps with the expected recovery signal. Hands off when the change is applied and the verification window has begun.
2. **`verifier` (verify):** Reads the log entry. Measures the same signals that detected the incident, waits for stability across multiple data intervals, cross-checks with at least one secondary signal, walks the mitigation's named blast radius for side effects, and decides: confirmed / partial / refuted. Advances on confirmed; rejects on partial or refuted with the specific failure named.

The hat order is `plan → do → verify` with the mitigator carrying plan-and-do because the planning and the action are tightly coupled and live in the same head during an active incident; a separate planner hat would add latency without adding rigor. The discipline that keeps mitigation safe (named hypothesis, exact change documented, rollback recorded, single-variable change) lives in the mitigator's process, not in a separate planner role.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`safety`) and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → mitigator → feedback-assessor`) dispatches against each open feedback. The mitigator re-owns the corrected action because mitigation choice and reversibility framing are mitigator-scope; the assessor independently decides closure.
4. **Gate** — The stage's gate is `[ask, await]` — the user chooses between a fast local approval (signing off that user-facing impact has stopped) or `await` to block on an external event such as a status-page resolution post or a regulatory clock closure. Both paths require explicit acknowledgment that mitigation is effective; this is the canonical "incident over for users" moment.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Non-reversible mitigation** is the highest-priority finding. The whole point of mitigation is that it's a safety budget for a wrong hypothesis; a non-reversible mitigation removes the budget. A destructive data operation or a one-way config rewrite used as a mitigation is a stop-the-presses finding.
- **Verification with a different signal than detection** is next — recovery measured on a metric that wasn't broken doesn't prove the broken metric recovered.
- **Concurrent mitigations** are findings on principle: when two changes are applied within the same stability window, attribution is impossible and the system gets two changes in its history that may not both have been necessary.
- **Partial mitigation accepted as full recovery** is a quiet but important finding — the resolve stage and the postmortem stage will both operate from the assumption that user impact is zero; if it's actually nonzero, both stages will get downstream gaps.
