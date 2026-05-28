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

Translate the assessment inventory into an executable mapping spec — every source field, every transformation rule, every dropped or derived value, every constraint difference. This is the design stage of the migration: it produces the contract the migrate stage implements verbatim, so anything not in the spec is not in the migration.

## Scope

Field-level and entity-level mapping plus compatibility analysis. Mapping decides *how source maps to target and what transforms apply* — not what's in scope (assessment), how the mapping is coded (migrate), or whether the result reconciles (validation). The output is a contract: the migrate stage builds exactly what the spec says and nothing it doesn't.

## What to do

- Author the field-level mapping tables — source field, target field, transform rule, null and encoding behavior — for each entity surface.
- Surface compatibility issues (type mismatches, constraint conflicts, semantic gaps, downstream-consumer impact) and key each finding to the mapping row it flags.
- Make every transformation rule precise enough that the migrate stage can implement it without guessing.
- Account for dropped and derived values explicitly, so nothing falls through silently.

## What NOT to do

- Don't write the migration code — that's the migrate stage building against this spec.
- Don't re-inventory the source or re-classify risk; consume the assessment inventory as given.
- Don't leave a compatibility finding floating free of the mapping row it concerns.
- Don't leave a transformation underspecified — an ambiguous rule becomes a data defect downstream.
