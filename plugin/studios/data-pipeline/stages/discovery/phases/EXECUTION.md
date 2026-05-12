# Discovery Stage — Execution

## Per-unit baton (`data-architect → schema-analyst → verifier`)

Every discovery unit walks the three hats in order. The baton across the rally race is the unit's own body accumulating discovered knowledge:

1. **`data-architect` (plan):** Reads the user's intent and any prior source notes. Maps source and target inventories, picks an integration pattern per source with a recorded reason, and surfaces variability dimensions. Hands off when the architecture brief is concrete enough that the schema-analyst knows exactly what to profile and at what depth.
2. **`schema-analyst` (do):** Reads the architecture brief. Profiles each source against actual sampled data — declared type vs. observed type, null rate, distinct counts, value distributions, encoding caveats, implicit-schema surfaces. Records cross-source type conflicts and semantic notes from source owners. Hands off when every column in scope has a recorded profile.
3. **`verifier` (verify):** Reads the unit body only. Validates substance (no placeholders / TODOs / empty sections), citation (claims trace back to sources or stakeholder conversations), internal consistency, and decision-register accountability. Advances on pass; rejects with the responsible hat named on fail.

The hat order is `plan → do → verify` because the architecture brief sets profiling scope and the profile is the substantive output the verifier checks.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The `completeness` review agent fires and files feedback for any source / target / schema / SLA / variability / type-conflict gap.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, data-architect, feedback-assessor]` dispatches per finding. The classifier routes the FB; the data-architect re-authors the affected portion of the brief; the assessor independently decides closure.
4. **Gate** — `review: auto` advances the stage automatically once review-track signs off. The downstream stages read `SOURCE-CATALOG.md` as ground truth.

## Reviewer guidance specific to this stage

- **Missing SLAs as numbers** is the highest-priority finding — vague freshness / completeness commitments become real bugs only after the validation stage runs and discovers the SLA isn't measurable.
- **Unrecorded integration-pattern reasons** are next — a choice without a reason will be second-guessed downstream, often by re-deciding mid-implementation.
- **Implicit-schema sources treated as declared** is the most insidious miss — JSON / log / semi-structured sources that look "documented" routinely surface new keys at runtime that the pipeline doesn't expect.
