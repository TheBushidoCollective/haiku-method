---
name: mapping
description: Map source schemas and systems to target, define transformation rules
hats: [schema-mapper, compatibility-reviewer, verifier]
fix_hats: [classifier, schema-mapper, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: assessment
    discovery: migration-inventory
---

# Mapping

Translate the assessment inventory into an executable mapping spec — every source field, every transformation rule, every dropped or derived value, every constraint difference. This is the design stage of the migration studio: units are mapping surfaces (entity-by-entity mappings, integration mappings, derived-field mappings), and the output is the contract that the migrate stage implements.

## Per-unit baton

Each mapping unit walks three hats in `plan/do → lens-review → verify` order:

- **`schema-mapper`** (plan / do for the mapping rows) reads the inventory for this entity / surface and produces the field-level mapping table — source field, target field, transform rule (rename / cast / derive / default / drop), null behavior, encoding behavior.
- **`compatibility-reviewer`** (lens-review) consumes the mapping rows and produces the compatibility findings — type mismatches with data loss, constraint conflicts, semantic gaps, downstream-consumer impact.
- **`verifier`** (verify) walks the unit body for table completeness, finding-to-row traceability, and decision-register consistency — the body-only structural check architecture §9 requires.

The baton is the mapping rows: every compatibility finding MUST cite the row(s) it flags. A finding floating free of the table is a sign the table is missing a row.

## Inputs and outputs

Mapping consumes `assessment/migration-inventory` and produces `MAPPING-SPEC.md` (the per-entity mapping tables + transformation rules + the compatibility analysis). The migrate stage consumes this spec verbatim — anything not in the spec is not in the migration.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, schema-mapper, feedback-assessor]` dispatches per finding. The classifier routes to the right unit; `schema-mapper` re-authors the affected mapping row(s); `feedback-assessor` closes. The gate is `ask` — local approval after the review agents and the user have signed off on the spec. Project overlays may add house conventions for representing transformations (Liquibase changelog format, dbt model conventions, ETL DAG snippets) without modifying the plugin defaults.
