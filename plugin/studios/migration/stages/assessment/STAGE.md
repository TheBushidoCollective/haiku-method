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

The opening stage of a migration: inventory everything in scope and surface the risk register before any mapping or moving begins. This is where the unknowns about the source system get turned into a documented picture — what exists, who owns it, what depends on what, and where the migration can hurt.

## Scope

Source-system inventory, dependency mapping, and risk classification. Assessment decides *what is being migrated and what could go wrong* — not how source maps to target (mapping), how the move is implemented (migrate), how it's verified (validation), or how it's cut over (cutover). Units are knowledge topics; downstream stages create their own work from what this stage finds.

## What to do

- Inventory the source surfaces — artifacts, owners, volumes, runtime touchpoints — and source every entry.
- Map the dependency graph so ordering constraints and blast radius are visible.
- Build a risk register where every entry (data-loss vector, downtime window, ordering constraint) cites the inventory row it derives from.
- Surface unknowns explicitly rather than assuming a surface is simple because it's undocumented.

## What NOT to do

- Don't define transformation rules or field mappings — that's the mapping stage.
- Don't write migration code or plan the cutover; those are downstream stages.
- Don't record a risk with no source inventory row, or an inventory that glosses over an unowned surface.
- Don't treat an undocumented dependency as nonexistent; a missed dependency is a migration failure later.
