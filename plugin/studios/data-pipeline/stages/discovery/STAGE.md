---
name: discovery
description: Understand data sources, schemas, volumes, and SLAs
hats: [data-architect, schema-analyst, verifier]
fix_hats: [classifier, data-architect, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
---

# Discovery

Map the data landscape before any code is written. This stage turns the user's
"we need to move data from A to B" into a documented inventory of every source
system, every target system, every schema in scope, the volumes and growth
curves, and the freshness / completeness / accuracy SLAs the pipeline will
have to honor. Downstream stages read this stage's output as ground truth —
if a column type is wrong here, the transformation stage will encode the
wrong type, and the validation stage will pass the wrong values.

## Per-unit baton

Each discovery unit is one **source-system knowledge artifact**. The unit
walks the three hats in `plan → do → verify` order:

- **`data-architect`** (plan) maps the source-target landscape, picks the
  integration pattern (batch / streaming / CDC), and writes the architecture
  brief
- **`schema-analyst`** (do) profiles the actual schema and data — types,
  nullability, cardinality, encoding, value distributions — and records what
  the source really looks like, not what its docs claim
- **`verifier`** (verify) validates the artifact body-only: substance,
  citation, internal consistency, decision-register accountability

Detailed process for each role lives in the per-hat md.

## Inputs and outputs

Discovery has no upstream stage — it bootstraps the intent. Its primary output
is `SOURCE-CATALOG.md`, an intent-scope knowledge artifact that every later
stage consumes. The catalog is a research artifact, not a build spec — it
documents what exists, not what to do.

## Fix loop and gate

`fix_hats: [classifier, data-architect, feedback-assessor]` dispatches per
finding. The gate is `auto` because discovery's deliverable is knowledge for
downstream stages — the engine validates substance via the verifier hat and
the completeness review agent, then moves on. Project overlays at
`.haiku/studios/data-pipeline/stages/discovery/` may add site-specific
documentation conventions or required source-system fields without modifying
the plugin defaults.
