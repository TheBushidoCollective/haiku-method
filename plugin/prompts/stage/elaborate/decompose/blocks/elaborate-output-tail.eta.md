**Elaboration produces the PLAN, not the deliverables:**
1. Research the problem space and write discovery artifacts to `knowledge/`
2. Define units with scope, completion criteria, and dependencies — NOT the actual work product
   - A unit spec says WHAT will be produced and HOW to verify it
   - The execution phase produces the actual deliverables
   - Do NOT write full specs, schemas, or implementations during elaboration
3. Author each unit with **`haiku_unit_write { intent: "<%= slug %>", stage: "<%= stage %>", unit: "unit-NNN-slug", body: "…", frontmatter: { … } }`** — **NOT** the generic `Write`/`Edit` tools. Unit files under `units/` are workflow-managed: a PreToolUse guard blocks generic file writes to them and just redirects you back to this tool, so reaching for `Write` only costs a wasted round-trip. `haiku_unit_write` enforces the lifecycle, validates frontmatter (naming · DAG · quality-gate · model — see the *Workflow Contracts* block above), and seals integrity.
4. Call `haiku_run_next { intent: "<%= slug %>" }` — the orchestrator validates and opens the review gate

File-naming + DAG + quality-gate + model-selection contracts are in the *Workflow Contracts (elaborate)* shared block already referenced above. Don't re-derive them here.
