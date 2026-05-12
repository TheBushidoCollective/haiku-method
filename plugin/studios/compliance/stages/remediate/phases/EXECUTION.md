# Remediate Stage — Execution

## Per-unit baton (`remediation-engineer → policy-writer → verifier`)

Every remediate unit walks the three hats in `plan → do → verify` order. Units in this stage are build-class — each closes a specific gap from `GAP-REPORT.md` with executable acceptance criteria and verify-commands.

1. **`remediation-engineer` (plan / do for technical controls):** Reads the gap entry, the control intent, and the unit's acceptance criteria. Diagnoses root cause, designs the technical change (configuration, code, infrastructure), implements it through the project's normal review surface, and pairs every AC with a concrete verify-command. Runs the verify-commands and cites their output. Hands off when the change is committed, deployed, and verified passing.
2. **`policy-writer` (do for governance controls):** Reads the same gap entry plus any technical change the engineer just made. Drafts or updates the required policy / procedure / standard, matches each policy clause to the controls it satisfies, names enforcement mechanisms or marks statements attestation-only with cadence + owner. Hands off when every governance gap has a published policy with mapped controls, named owner, and review cadence.
3. **`verifier` (verify):** Reads the unit body. Validates that the body substantively addresses every acceptance criterion, that acceptance criteria are paired with verify-commands, that the verify-commands actually pass (re-runs them), that the artifact aligns with the decision register, and that open questions are accounted for. Either advances or rejects with the failed criterion named.

Units that need only technical work flow `remediation-engineer → verifier`; units that need only governance work flow `policy-writer → verifier`; units that need both walk all three.

## After execute completes

When every unit's chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — universal hard gate; the built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — the stage's `effectiveness` lens fires alongside any studio-level review agents. Note: `effectiveness` is also pulled into `certify` via `review-agents-include` so policy-vs-practice drift surfaces before external audit.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, remediation-engineer, feedback-assessor]` dispatches per finding; the classifier routes the FB, `remediation-engineer` re-implements technical fixes (or routes governance findings via classifier to `policy-writer`), the assessor independently decides closure.
4. **Gate** — `ask`. Remediation often touches production systems and the cost of unreviewed change is high, so a human approves locally before document and certify consume the changes.
