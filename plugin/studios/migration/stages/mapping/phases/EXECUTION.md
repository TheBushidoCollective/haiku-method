# Mapping Stage — Execution

## Per-unit baton (`schema-mapper → compatibility-reviewer`)

Every mapping unit walks the two hats in order. The baton is the mapping table itself:

1. **`schema-mapper` (plan / do for the mapping rows):** Reads the upstream inventory entry for this entity / surface, produces the field-level mapping table — every source field as a row, every target field as a row, every transform rule using the typed categories (rename / cast / derive / default / drop), every null behavior explicit. Hands off when every field is accounted for and every constraint difference has a resolution.
2. **`compatibility-reviewer` (do for compatibility analysis):** Reads the mapping rows and walks each through four lenses (type fidelity, constraint compatibility, semantic equivalence, downstream impact). Files findings into the unit body with citations to the rows they flag and a recommended resolution per finding. Hands off when every row has been walked through every applicable lens.

Mapping is a design-class stage; the per-unit chain has no terminal verifier because the engine's spec-verify gate and the `accuracy` review agent close out the verify role at stage close.

## After execute completes

When every mapping unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the mapping tables conform to the intent's spec.
2. **Quality review (parallel)** — `accuracy` and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — `fix_hats:` chain (`classifier → schema-mapper → feedback-assessor`) dispatches per finding. The classifier routes; `schema-mapper` re-authors the affected mapping row(s); `feedback-assessor` closes.
4. **Gate** — The stage's gate is `ask` — local approval after the review agents and the user sign off. Project overlays MAY swap or extend the gate (`external` for teams that require schema review through a separate platform).

## Reviewer guidance specific to this stage

- **Silent drops or silent defaults** are the highest-priority finding. A source field with no row, or a target field with no row, will become a runtime corruption — explicit "drop with rationale" or "derive from X" must replace silence.
- **Untyped transform rules** (prose descriptions of what to do, rather than one of the typed categories) drift between reviewer and implementer. Reject prose; demand the typed category plus a one-line note for the unusual cases.
- **Same-name-different-meaning fields** are the classic mapping bug — status enums, soft-vs-hard delete flags, currency fields without explicit currency codes, timestamp fields without explicit timezones. Findings here block runtime bugs.
- **Constraint relaxations not flagged** (target drops a unique / FK / check constraint the source enforced) propagate as data-quality drift in validation. Catch them here.
- **Compatibility findings missing risk-register cross-references** are a sign the assessment stage missed something; flag for back-propagation rather than absorbing the gap locally.
