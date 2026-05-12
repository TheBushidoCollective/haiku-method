# Audit Stage — Execution

## Per-unit baton (`auditor → gap-analyst → verifier`)

Every audit unit walks the three hats in order. The baton is the unit's body accumulating evidence as it advances:

1. **`auditor` (plan):** Scopes the inventory against a named audience, walks the documentation surface, and records each artifact with currency, accuracy, and accessibility assessments. Notes missing surfaces against the audience's tasks. Hands off when the inventory is complete, every assessment cites evidence (or is honestly marked `unverified`), and the missing-surface list is named.
2. **`gap-analyst` (do):** Reads the inventory, categorizes each gap (missing / outdated / inaccurate / inaccessible / wrong mode / unowned), scores severity × frequency with cited evidence, ranks the result, and recommends a doc mode for top-tier items. Hands off when every gap is categorized, every priority placement is backed by an inventory row or user-impact signal, and item coupling is noted.
3. **`verifier` (verify):** Validates the unit body against the audit-stage criteria — substance, citation, internal consistency, decision-register alignment. Advances on pass; rejects to the responsible hat when the body is placeholder, the audience isn't named, or claims aren't backed.

The hat order is `plan → do → verify` because the auditor's inventory IS the plan, the gap analyst's ranked list IS the do (the work the rest of the studio consumes), and the verifier closes the unit.

## After execute completes

When every audit unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the audit artifacts match the intent's spec.
2. **Quality review (parallel)** — The stage's `coverage` review agent and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, auditor, feedback-assessor]` dispatches per finding. The classifier targets the FB; the auditor re-inventories or re-ranks; the assessor decides closure.
4. **Gate** — The stage's gate is `auto`. Once review passes and (in non-autopilot modes) the user approves, the workflow advances to outline.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **No named audience** is the highest-priority finding. Rankings without an audience are guesswork and propagate misprioritization into every downstream stage.
- **Unbacked severity / frequency ratings** are next. They produce a confident-looking list that pushes the wrong work to the front.
- **Sample-based inventories** miss orphaned and informal docs; the missing items will surface as gaps later, after outline has already committed to a structure.
- **Outdated / inaccurate items mislabeled as "missing"** changes the remediation downstream — outdated docs need either deletion or a rewrite, not "write a new doc."
