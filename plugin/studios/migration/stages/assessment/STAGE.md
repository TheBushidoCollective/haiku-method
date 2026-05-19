---
name: assessment
description: Inventory what's being migrated, identify risks and dependencies
hats: [migration-analyst, risk-assessor, verifier]
fix_hats: [classifier, migration-analyst, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
---

# Assessment

Inventory the migration scope and surface the risk register. This is the research stage of the migration studio — units are knowledge topics (source-system surfaces, dependency clusters, risk categories), NOT execution work. Downstream stages create their own units from what this stage discovers.

## Per-unit baton

- `migration-analyst` → `risk-assessor`: inventory rows for the unit's slice (artifacts, owners, volumes, dependencies, runtime touchpoints, sourced).
- `risk-assessor` → `verifier`: risk register entries traced back to inventory rows (data-loss vectors, downtime windows, blast radius, ordering constraints, mitigations).

The baton is the inventory itself: every risk entry MUST cite the inventory row(s) it derives from. A risk with no source row is a sign the inventory missed something.

## Inputs and outputs

Assessment has no upstream stage inputs — it's the entry point. Outputs are `MIGRATION-INVENTORY.md` (the source-system inventory + dependency graph + risk register), which feeds every downstream stage.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, migration-analyst, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right unit; `migration-analyst` is the implementer (re-authoring the inventory or risk section where the finding lands); `feedback-assessor` decides closure. The gate is `auto` — assessment passes when the inventory and risk register are substantively complete and the review agents sign off; no external doc review is required at this stage. Project overlays at `.haiku/studios/migration/stages/assessment/` may add team-specific risk taxonomies or inventory column conventions without modifying the plugin defaults.
