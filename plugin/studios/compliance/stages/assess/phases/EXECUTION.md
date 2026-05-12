# Assess Stage — Execution

## Per-unit baton (`auditor → risk-assessor`)

Every assess unit walks the hat chain in order. The baton across the chain is the unit's body content plus its contribution to the intent-scope `GAP-REPORT.md`:

1. **`auditor` (plan / do):** Reads the upstream `CONTROL-MAPPING.md`. For each (control, system) pair, gathers concrete evidence (config exports, code references, logs, signed attestations), determines status (`met` / `partially met` / `unmet`), and writes the per-control finding with control intent + evidence reviewed + deficiency description. Hands off when every in-scope (control, system) pair has a status + evidence trail + deficiency description (for non-met items).
2. **`risk-assessor` (do / verify):** Takes the auditor's findings, selects (or proposes for confirmation) a scoring methodology, assigns likelihood + impact + residual-risk scores per gap with rationale, credits compensating controls explicitly, surfaces dependencies between gaps, and publishes the prioritized list. Hands off when every gap has a complete risk profile and the prioritized list is published.

This stage's hat chain currently omits a dedicated verifier — `risk-assessor`'s scoring pass implicitly checks the auditor's findings by trying to translate each into a risk score. (Uncertainty flagged: pure plan → do → verify per architecture §3 would add a third hat; structural change is out of scope for this content pass.)

## After execute completes

When every unit's chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — universal hard gate; the built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — the stage's `accuracy` and `thoroughness` lenses fire alongside any studio-level review agents. Note: `thoroughness` is also referenced from `certify` via `review-agents-include` so cross-stage findings surface at certification time.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, auditor, feedback-assessor]` dispatches per finding; the classifier routes the FB to the right unit or sibling stage, `auditor` re-evaluates as the implementer, the assessor independently decides closure.
4. **Gate** — `ask`. Assessment findings carry organizational and legal weight, so a human approves locally before remediation work begins.
