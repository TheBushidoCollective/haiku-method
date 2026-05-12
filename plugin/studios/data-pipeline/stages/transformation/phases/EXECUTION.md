# Transformation Stage — Execution

## Per-unit baton (`transformer → data-modeler → verifier`)

Every transformation unit walks the three hats. The baton is the model spec, then the materialization code that conforms to it, then the validated artifact:

1. **`data-modeler` (plan, conceptually):** Defines the model — grain, columns, primary key, SCD type per dimension, primary-query access patterns — and writes the spec into `DATA-MODEL.md`. Validates the model against the user's known query patterns before declaring it done. Hands off when the model is concrete enough that the transformer can implement it without re-deciding grain or keys.
2. **`transformer` (do):** Reads the model spec. Writes transformation code as a sequence of named intermediate steps, centralizes business rules per concept, makes every type coercion / null treatment / timezone treatment explicit, and guarantees idempotency (deterministic dedup, stable surrogate keys, deterministic SCD change application). Hands off when the materialized output matches the model spec column-for-column.
3. **`verifier` (verify):** Reads the unit body only. Validates substance, citation, internal consistency, and decision-register accountability. Advances on pass; rejects with the responsible hat named on fail.

Note: the `hats:` order is declared as `transformer, data-modeler, verifier` for historical reasons, but the model is the logical plan and the transformation is the logical do. Treat the data-modeler's spec as the load-bearing handoff regardless of file order. A future revision may swap the declared order.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The `data-quality` review agent fires and files feedback for grain compliance, primary-key uniqueness, SCD correctness, type-conversion explicitness, null / sentinel handling, timezone handling, deduplication determinism, referential integrity, and business-logic centralization.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, transformer, feedback-assessor]` dispatches per finding. The classifier routes the FB; the transformer re-authors the affected transformation code; the assessor independently decides closure. If the finding is structural (model-level), the implementer flags the FB back to the modeler via classifier-routed feedback, not by mutating the model in transformer code.
4. **Gate** — `review: ask` blocks for a human to sign off on the data model and the transformation logic before validation tests run against them.

## Reviewer guidance specific to this stage

- **Grain mismatch** (model declared "one row per order", output has duplicates per order) is the highest-priority finding — every downstream metric will be wrong by an unknown factor.
- **Wrong SCD type** (using Type 1 where Type 2 is needed, or vice versa) is the second-highest — it surfaces as analyst bug reports months after the wrong data was queried.
- **Business logic in two places** with subtly different implementations is the third — reviewers will hunt for which copy is correct and pick wrong.
- **Implicit type coercion** in a join condition is the most insidious miss — the join silently filters or duplicates rows depending on coercion semantics nobody declared.
