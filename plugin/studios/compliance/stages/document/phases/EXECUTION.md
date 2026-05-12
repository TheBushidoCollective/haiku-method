# Document Stage — Execution

## Per-unit baton (`evidence-collector → documentation-writer → verifier`)

Every document unit walks the three hats in `plan → do → verify` order. The baton across the chain is the unit's contribution to the intent-scope `EVIDENCE-PACKAGE.md`:

1. **`evidence-collector` (plan / do for artifacts):** Reads `REMEDIATION-LOG.md` (every remediation's verify-output becomes an evidence item), `GAP-REPORT.md` (every met control already cites evidence), and `CONTROL-MAPPING.md` (the full list of controls evidence must cover). Gathers concrete artifacts with full provenance (what / where / when / who / which control / where it lives now), maps every control to its evidence rows, and flags coverage gaps explicitly. Hands off when every control has a populated evidence row OR an acknowledged gap with routing.
2. **`documentation-writer` (do for narrative):** Reads the evidence inventory and the upstream artifacts. Picks the package structure (default: by control family), writes per-control narratives that cite specific evidence rows, builds the chronological audit-trail summary, and writes the management summary that honestly describes coverage including any acknowledged gaps. Hands off when every in-scope control has a narrative section and the audit-trail summary is continuous.
3. **`verifier` (verify):** Reads the unit body. Validates substance, citation, internal consistency (narrative claims trace to evidence rows; cross-references resolve), decision-register alignment, open-question accounting. Either advances or rejects.

## After execute completes

When every unit's chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — universal hard gate; the built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — the stage's `evidence-quality` lens fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, evidence-collector, feedback-assessor]` dispatches per finding; the classifier routes the FB, `evidence-collector` re-gathers missing evidence or fixes provenance gaps (routing narrative-only findings to `documentation-writer` via classifier), the assessor independently decides closure.
4. **Gate** — `ask`. Evidence sufficiency is a judgment call the auditor will second-guess and the team needs to align before that conversation, so a human approves locally before certify consumes the package.
