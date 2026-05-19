# Audit Stage — Execution

## Per-unit baton (`auditor → gap-analyst → verifier`)

Every audit unit walks the three hats in order. The baton is the unit's body accumulating evidence as it advances:

1. **`auditor` (plan):** Scopes the inventory against a named audience, walks the documentation surface, and records each artifact with currency, accuracy, and accessibility assessments. Notes missing surfaces against the audience's tasks. Hands off when the inventory is complete, every assessment cites evidence (or is honestly marked `unverified`), and the missing-surface list is named.
2. **`gap-analyst` (do):** Reads the inventory, categorizes each gap (missing / outdated / inaccurate / inaccessible / wrong mode / unowned), scores severity × frequency with cited evidence, ranks the result, and recommends a doc mode for top-tier items. Hands off when every gap is categorized, every priority placement is backed by an inventory row or user-impact signal, and item coupling is noted.
3. **`verifier` (verify):** Validates the unit body against the audit-stage criteria — substance, citation, internal consistency, decision-register alignment. Advances on pass; rejects to the responsible hat when the body is placeholder, the audience isn't named, or claims aren't backed.

The hat order is `plan → do → verify` because the auditor's inventory IS the plan, the gap analyst's ranked list IS the do (the work the rest of the studio consumes), and the verifier closes the unit.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coverage` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coverage` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → auditor → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `auditor` is the implementer (re-inventories or re-ranks); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Once review passes and (in non-autopilot modes) the user approves, the workflow advances to outline.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **No named audience** is the highest-priority finding. Rankings without an audience are guesswork and propagate misprioritization into every downstream stage.
- **Unbacked severity / frequency ratings** are next. They produce a confident-looking list that pushes the wrong work to the front.
- **Sample-based inventories** miss orphaned and informal docs; the missing items will surface as gaps later, after outline has already committed to a structure.
- **Outdated / inaccurate items mislabeled as "missing"** changes the remediation downstream — outdated docs need either deletion or a rewrite, not "write a new doc."
