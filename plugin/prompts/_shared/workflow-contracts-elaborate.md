### Workflow Contracts (REQUIRED — global framework rules)

> ## ⟁ NO UNIT ADVANCES WITHOUT A VERIFICATION PATH.
> Every acceptance criterion pairs with a command, condition, or review-agent mandate that proves it. No exceptions.

These rules apply to **every studio and every stage**. They are framework-enforced — re-stating them in per-studio files is forbidden (they drift).

#### Unit file naming

- `stages/{stage}/units/unit-NNN-slug.md` — 3-digit zero-padded number, kebab-case slug, `.md` extension. Legacy 2-digit names still resolve via numeric-prefix matching.
- Numbers are monotonically increasing across the stage's lifetime, including revisits. Never reuse a number.
- The workflow engine validates naming at `haiku_run_next` — non-compliant files block the advance.

#### Unit DAG (`depends_on:`)

- `depends_on:` lists same-stage unit names that must complete first. Omit or leave empty for no dependencies.
- The DAG MUST be acyclic. Cycles block the advance.
- Cross-stage dependencies go in STAGE.md `inputs:` and resolve to concrete output files from prior stages.

#### Quality gates

- `quality_gates:` MUST be a list of **executable gate objects** — `{ name, command, dir? }` — not prose strings. Non-zero exit at `haiku_unit_advance_hat` blocks the advance. Prose-only gates are silently skipped (no enforcement).
- **Scope rule**: gate commands MUST audit the **full stage artifact directory** (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:`. Enforcement scope must match rule scope.
- Commands should be idempotent and fast (< 5s). Negate banned-pattern greps (`! grep …`) so exit 0 means pass.
- Prose descriptions of what the gate *means* belong in the unit body under `## Completion criteria`, NOT in the frontmatter.

#### Model selection (`model:` frontmatter on each unit)

- Set `model:` per unit. The cascade is `unit > hat > stage > studio` — omit only when the default tier is the right pick.
- Valid values: `haiku` (mechanical edits, rename sweeps, boilerplate), `sonnet` (most real work — the default when unsure), `opus` (novel design, deep debugging, cross-cutting architecture). Unknown strings fall through.
- Calibrate per-unit. Picking one tier for the whole intent wastes budget on trivial units and starves the hard ones.

#### Revisit cycles — `closes:` frontmatter

- On iteration > 1, new units MUST declare `closes: [FB-NN, …]` listing every feedback id they address.
- Every pending FB MUST be referenced by at least one new unit's `closes:` — orphans block advancement.
- Resolution paths: (a) draft new units that close findings (additive-elaboration), (b) fix existing unit specs and close via `haiku_feedback_update status=closed` (pre-execute spec revisit), or (c) reject stale/invalid findings via `haiku_feedback_reject` with a concrete reason.

#### MCP tool contracts

- `haiku_run_next { intent }` advances the lifecycle. Never write `intent.md` frontmatter or unit workflow fields directly — the engine owns those.
- `haiku_feedback { origin: "discovery", resolution: "question" }` surfaces a discovery-time question. The elaborate loop's completion signal stays unmet until the FB closes.

#### Unit content quality (validated at advance)

- Placeholder strings are forbidden in unit specs and frontmatter. The workflow engine rejects unit advancement when any of these appear: `TBD`, `tbd`, `similar to`, `add error handling`, `etc.`, or a literal `...`. Either write the concrete value or surface it as a question.
- Every acceptance criterion MUST be testable — paired with a command or condition that proves it. `tests pass` is rejected; the verify-command must be concrete and exit-code-driven (e.g. `pnpm test --run path/to/file` exits 0).
- Criteria are drafted as **pairs**: goal-prose lives in the unit body under `## Completion criteria`; the executable check lives in `quality_gates:`. Domain-specific examples are the stage-tier ELABORATION.md's job, not this contract's.

#### Red flags (STOP and re-read this contract if you catch yourself thinking)

- "I'll write `TBD` for the parts I'm unsure about" — placeholders block advancement.
- "I'll add `similar to unit-XX` to save typing" — cross-references rot; copy the relevant content explicitly.
- "The criteria are obvious; I'll keep them prose" — every criterion needs an executable check.
- "This unit can be huge; the executor will figure it out" — multi-bolt-to-scope units are decomposition failures.
- "I'll batch the missing info as assumptions in the spec" — silent assumptions become invisible regressions; ask the user.
