**Elaboration produces the PLAN, not the deliverables:**
1. Research the problem space and write discovery artifacts to `knowledge/`
2. Define units with scope, completion criteria, and dependencies — NOT the actual work product
   - A unit spec says WHAT will be produced and HOW to verify it
   - The execution phase produces the actual deliverables
   - Do NOT write full specs, schemas, or implementations during elaboration
3. Write unit files to `.haiku/intents/<%= slug %>/stages/<%= stage %>/units/`
4. Call `haiku_run_next { intent: "<%= slug %>" }` — the orchestrator validates and opens the review gate

**Unit file naming convention (REQUIRED):**
Files MUST be named `unit-NNN-slug.md` where:
- `NNN` is a 3-digit zero-padded sequence number (`001`, `002`, … `010`, `099`, `100`, max `999`)
- `slug` is a kebab-case descriptor (e.g., `user-auth`, `data-model`)
- Example: `unit-001-data-model.md`, `unit-002-api-endpoints.md`

Legacy 2-digit names (`unit-01-foo.md`) still resolve via numeric-prefix matching, so existing intents keep working — but new files in fresh intents use 3 digits.

Files that don't match this pattern will not appear in the review UI and will block advancement.