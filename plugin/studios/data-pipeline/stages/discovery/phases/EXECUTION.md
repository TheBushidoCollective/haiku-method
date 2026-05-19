# Discovery Stage — Execution

## Per-unit baton (`data-architect → schema-analyst → verifier`)

Every discovery unit walks the three hats in order. The baton across the rally race is the unit's own body accumulating discovered knowledge:

1. **`data-architect` (plan):** Reads the user's intent and any prior source notes. Maps source and target inventories, picks an integration pattern per source with a recorded reason, and surfaces variability dimensions. Hands off when the architecture brief is concrete enough that the schema-analyst knows exactly what to profile and at what depth.
2. **`schema-analyst` (do):** Reads the architecture brief. Profiles each source against actual sampled data — declared type vs. observed type, null rate, distinct counts, value distributions, encoding caveats, implicit-schema surfaces. Records cross-source type conflicts and semantic notes from source owners. Hands off when every column in scope has a recorded profile.
3. **`verifier` (verify):** Reads the unit body only. Validates substance (no placeholders / TODOs / empty sections), citation (claims trace back to sources or stakeholder conversations), internal consistency, and decision-register accountability. Advances on pass; rejects with the responsible hat named on fail.

The hat order is `plan → do → verify` because the architecture brief sets profiling scope and the profile is the substantive output the verifier checks.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → data-architect → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `data-architect` is the implementer (re-authors the affected portion of the brief); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Advances the stage automatically once review-track signs off. The downstream stages read `SOURCE-CATALOG.md` as ground truth.

## Reviewer guidance specific to this stage

- **Missing SLAs as numbers** is the highest-priority finding — vague freshness / completeness commitments become real bugs only after the validation stage runs and discovers the SLA isn't measurable.
- **Unrecorded integration-pattern reasons** are next — a choice without a reason will be second-guessed downstream, often by re-deciding mid-implementation.
- **Implicit-schema sources treated as declared** is the most insidious miss — JSON / log / semi-structured sources that look "documented" routinely surface new keys at runtime that the pipeline doesn't expect.
