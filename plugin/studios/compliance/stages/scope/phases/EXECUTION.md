# Scope Stage — Execution

## Per-unit baton (`compliance-analyst → scope-definer → verifier`)

Every scope unit walks the three hats in order. The baton across the chain is the unit's body content plus its contribution to the intent-scope `CONTROL-MAPPING.md`:

1. **`compliance-analyst` (plan):** Reads the engagement brief, identifies the framework(s) + version + revision, enumerates applicable / not-applicable / inherited controls with rationale. Hands off when every in-scope framework has an applicability decision for every control and overlap across frameworks is surfaced.
2. **`scope-definer` (do):** Reads the framework + applicable-controls section just written. Builds the system inventory (including third-party services and integrations), classifies data per system, maps each applicable control to its bound systems, and records in-scope / out-of-scope decisions with rationale per framework. Hands off when every applicable control is mapped and every system has an explicit per-framework scope call.
3. **`verifier` (verify):** Reads the unit body. Validates substance (artifact answers its topic), citation (non-trivial claims source-cited), internal consistency, decision-register alignment, open-question accounting. Either advances or rejects with the failed criterion named, rewinding to the responsible hat.

Plan → do → verify is load-bearing here because applicability is the plan, the system mapping is the do, and the body-level coherence check is the verify. Reordering breaks the contract.

## After execute completes

When every unit's chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — universal hard gate; the built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — the stage's `completeness` lens fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, compliance-analyst, feedback-assessor]` dispatches per finding; the classifier routes the FB, `compliance-analyst` re-authors as the implementer, the assessor independently decides closure.
4. **Gate** — `auto`. Downstream stages will surface real misclassifications via their own findings, so the engine advances once verifiers approve. Scope feedback that emerges later flows back via the pre-tick triage gate.
