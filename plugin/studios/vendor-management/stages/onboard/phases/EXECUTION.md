# Onboard Stage — Execution

## Per-unit baton (`integrator → coordinator → verifier`)

Every onboard unit walks the three hats in order. The baton across the rally race is the onboarding checklist accumulating on disk with verified post-conditions:

1. **`integrator` (plan / do for technical setup):** Reads the negotiation terms before configuring anything (vendor defaults do not match contractual terms). Provisions accounts and access using the organization's identity / SSO / role patterns. Wires the integration with the right pattern (push / pull / batch / streaming) including auth, retries, idempotency, instrumentation. Executes data migration with a documented integrity check on the loaded data. Tests end-to-end including auth failure, vendor-side outage, data-shape failure, and realistic-load performance. Hands off when every test has passed and the integration architecture, account inventory, runbooks, and monitoring / alerting are documented.
2. **`coordinator` (do for organizational readiness):** Builds the onboarding checklist across every workstream (IT, security, business, finance, legal, vendor-side) with owner, due signal, post-condition check, and rollback per item. Establishes communication channels and a kickoff cadence; locks the escalation matrix from the contract (not vendor defaults) and tests it with a real signal. Plans training with an adoption check, not just an attendance signal. Documents organizational deltas (current state → new state) and communicates them to affected process owners. Signs off readiness only when every workstream's post-condition is green.
3. **`verifier` (verify):** Reads each unit's body and validates that preconditions, action, post-condition, and rollback (or explicit "no rollback — forward-fix only" rationale) are all named and substantive. Advances when the bar is met; rejects to the responsible hat naming the failed criterion when it isn't.

The hat order produces the validated readiness signal — technical setup, organizational readiness, and verifier sign-off compose into "the organization can use this vendor."

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate; the built-in spec-conformance subagent confirms the onboarding artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`readiness`) and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → integrator → feedback-assessor`) dispatches against each open feedback. The classifier routes; the integrator re-runs the affected setup or test; the assessor independently decides closure.
4. **Gate** — The stage's gate is `auto` — the engine advances on its own once every onboarding step has passed its post-condition check.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Happy-path-only testing** is the highest-priority finding — failure-mode probes are the only way to know the integration survives reality.
- **Vendor defaults left in place** that contradict the contract (retention, access scope, audit logging) are reject-worthy.
- **Training delivered but not adopted** is unfinished onboarding — adoption signals are required.
- **Escalation contacts documented but never tested** routinely turn out stale; a real test signal is the only proof.
- **Data migration without a documented integrity check** is unfinished work.
