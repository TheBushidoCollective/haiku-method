# Close Stage — Execution

## Per-unit baton (`controller → reconciler → verifier`)

Every close unit walks the three hats in `plan → do → verify` order:

1. **`controller` (plan):** Reads the variance report and reporting outputs. Defines cut-off rules for revenue, expense, and inventory / capex. Orders the close steps by hard dependency (sub-ledger posting → adjusting entries → reconciliations → intercompany eliminations → consolidation → trial balance tie → sign-off). States preconditions, action, and post-condition per step. Defines rollback or forward-fix policy for non-idempotent steps. Names the supporting documentation requirements. Sets the exception tolerance and sign-off framework. Hands off when the plan is concrete enough that the reconciler can execute without re-deciding.
2. **`reconciler` (do):** Confirms preconditions before each step. Reconciles each balance-sheet account at detail level (line / transaction, not just summary). Posts adjusting entries with supporting documentation references and policy basis. Eliminates intercompany transactions with matched-pair references. Documents reconciling items with cause, owner, expected resolution. Confirms trial-balance tie. Hands off when the trial balance ties and exceptions are within tolerance.
3. **`verifier` (verify):** Reads the unit body. Validates that preconditions / action / post-condition are stated for every step, post-conditions are verifiable, rollback is named where applicable, and decision-register alignment holds.

The hat order is `plan → do → verify` because close steps have hard dependencies that the controller orders before the reconciler runs them; verifier checks against the operational-unit substance criteria.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `compliance` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `compliance` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → controller → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `controller` is the implementer (re-defines the reconciliation); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. Period close typically requires controller signoff plus external-auditor review or board attestation. The engine waits for the external approval signal before sealing.

## Reviewer guidance specific to this stage

- **A reconciliation that ties only in total** but not at the line / transaction level is a coincidence, not a reconciliation — highest-priority correctness finding.
- **An adjusting entry posted without supporting documentation** is unauditable and a hard-block finding regardless of whether the entry is materially correct.
- **Un-eliminated intercompany balances** gross up consolidated assets and liabilities and are a known fraud pattern — hard-block any sign-off with open intercompany balances.
- **Cut-off rules applied differently to revenue and cost of revenue** in the same period produce a mismatched margin and misstate profitability.
- **Reconciling items rolled forward from prior periods** without resolution or re-classification erodes balance-sheet integrity silently over time.
