# Scope Stage — Execution

## Per-unit baton (`compliance-analyst → scope-definer → verifier`)

Every scope unit walks the three hats in order. The baton across the chain is the unit's body content plus its contribution to the intent-scope `CONTROL-MAPPING.md`:

1. **`compliance-analyst` (plan):** Reads the engagement brief, identifies the framework(s) + version + revision, enumerates applicable / not-applicable / inherited controls with rationale. Hands off when every in-scope framework has an applicability decision for every control and overlap across frameworks is surfaced.
2. **`scope-definer` (do):** Reads the framework + applicable-controls section just written. Builds the system inventory (including third-party services and integrations), classifies data per system, maps each applicable control to its bound systems, and records in-scope / out-of-scope decisions with rationale per framework. Hands off when every applicable control is mapped and every system has an explicit per-framework scope call.
3. **`verifier` (verify):** Reads the unit body. Validates substance (artifact answers its topic), citation (non-trivial claims source-cited), internal consistency, decision-register alignment, open-question accounting. Either advances or rejects with the failed criterion named, rewinding to the responsible hat.

Plan → do → verify is load-bearing here because applicability is the plan, the system mapping is the do, and the body-level coherence check is the verify. Reordering breaks the contract.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → compliance-analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `compliance-analyst` is the implementer (re-authors as the implementer, the assessor independently decides closure); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Downstream stages will surface real misclassifications via their own findings, so the engine advances once verifiers approve.
