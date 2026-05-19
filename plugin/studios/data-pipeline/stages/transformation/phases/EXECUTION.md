# Transformation Stage — Execution

## Per-unit baton (`transformer → data-modeler → verifier`)

Every transformation unit walks the three hats. The baton is the model spec, then the materialization code that conforms to it, then the validated artifact:

1. **`data-modeler` (plan, conceptually):** Defines the model — grain, columns, primary key, SCD type per dimension, primary-query access patterns — and writes the spec into `DATA-MODEL.md`. Validates the model against the user's known query patterns before declaring it done. Hands off when the model is concrete enough that the transformer can implement it without re-deciding grain or keys.
2. **`transformer` (do):** Reads the model spec. Writes transformation code as a sequence of named intermediate steps, centralizes business rules per concept, makes every type coercion / null treatment / timezone treatment explicit, and guarantees idempotency (deterministic dedup, stable surrogate keys, deterministic SCD change application). Hands off when the materialized output matches the model spec column-for-column.
3. **`verifier` (verify):** Reads the unit body only. Validates substance, citation, internal consistency, and decision-register accountability. Advances on pass; rejects with the responsible hat named on fail.

Note: the `hats:` order is declared as `transformer, data-modeler, verifier` for historical reasons, but the model is the logical plan and the transformation is the logical do. Treat the data-modeler's spec as the load-bearing handoff regardless of file order. A future revision may swap the declared order.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → transformer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `transformer` is the implementer (re-authors the affected transformation code); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Blocks for a human to sign off on the data model and the transformation logic before validation tests run against them.

## Reviewer guidance specific to this stage

- **Grain mismatch** (model declared "one row per order", output has duplicates per order) is the highest-priority finding — every downstream metric will be wrong by an unknown factor.
- **Wrong SCD type** (using Type 1 where Type 2 is needed, or vice versa) is the second-highest — it surfaces as analyst bug reports months after the wrong data was queried.
- **Business logic in two places** with subtly different implementations is the third — reviewers will hunt for which copy is correct and pick wrong.
- **Implicit type coercion** in a join condition is the most insidious miss — the join silently filters or duplicates rows depending on coercion semantics nobody declared.
