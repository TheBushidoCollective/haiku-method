**Focus:** Translate the unit's completion criteria + the upstream product / design / inception context into a concrete implementation plan that the builder hat can execute without guessing. The plan is the baton handed to the builder — it must be specific enough that a builder who has not read the upstream artifacts can still ship correct code by following it. Vague plans are how implementations drift from specs.

The plan is **tactical, not strategic**: file paths, function signatures, sequence of changes, test-first ordering, named risks. It is NOT architecture exploration — architecture decisions land at the design / inception stages and are inputs here, not outputs.

## Process

### 1. Read your inputs in order

- The unit body — completion criteria, success criteria, any pre-existing notes
- The product stage's `ACCEPTANCE-CRITERIA.md` for this slice
- The product stage's `.feature` files that map to this unit's criteria
- The product stage's `DATA-CONTRACTS.md` rows that this unit touches
- The design stage's `DESIGN-BRIEF.md` + `DESIGN-TOKENS.md` (and `design-artifacts/` if the unit touches UI)
- The inception stage's `DISCOVERY.md` for the relevant knowledge surfaces
- Sibling units' completed plans + outputs, where `depends_on:` points at them
- The project's actual code — `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` to know the stack, and a `git log -- <relevant paths>` to know recent intent in the area you'll touch

### 2. Identify risks before writing the plan

A risk is anything that could turn this unit's bolt into more than one bolt. Common ones:

- **High-churn files** — `git log --oneline -20 -- <file>` shows ≥ 5 recent commits. The area is in flux; coordinate or pick a quieter seam.
- **Stable files** — no recent commits. Conservative posture; communicate intent in commits.
- **Recent refactor in the area** — there's a directional intent you might be undoing.
- **Shared code with multiple consumers** — changes here ripple. Plan the consumer audit BEFORE the change.
- **Cross-cutting concerns** (auth, logging, error handling) — touching these without a stated scope is how scope creep enters.
- **Migration / data-shape change** — needs an explicit backfill + rollback plan inline.

State each identified risk and the mitigation. If the mitigation is "investigate further", do that investigation NOW and rewrite the plan once you know — handing an open investigation to the builder is how 3-bolt loops happen.

### 3. Map every AC item to a concrete test

For each AC item / `.feature` scenario this unit covers, declare the test that will verify it. The test is what RED looks like in TDD:

```
| AC ref           | Test file + name                                      | Test framework |
|------------------|-------------------------------------------------------|----------------|
| AC-1.2.1         | tests/api/signup.test.ts > rejects invalid email      | vitest         |
| features:Locked  | tests/api/login.test.ts > 423 when account is locked  | vitest         |
| SC-3 (boundary)  | tests/api/signup.test.ts > rejects 10001th signup     | vitest         |
```

The builder hat will execute this table top-to-bottom: write the failing test, watch it fail for the right reason, write the minimum code to pass, refactor. Every row is one RED → GREEN → REFACTOR cycle. If a row's test is "covered by the existing X test" — say so explicitly, don't omit the row.

### 4. Write the change plan

For each file to touch:

```
### <path/to/file.ts>

**Why:** <one sentence — what this file's change does for the AC>

**Touch points:**
- Add `function newThing(...)` — signature, return type, brief contract
- Modify `existingFunction` — what changes, why, what the consumer impact is
- Move `helper` from <old/path> to <new/path> — what depends on it

**Order:**
1. Write failing test in <test file>
2. Add the function / change the function
3. Run the AC's verify command
4. Refactor if needed
```

Order matters within a file (you may need a new module before the consumer can import it). Order matters across files (the contract change usually goes before the consumer change).

### 5. List the verify commands

Pull the unit's `quality_gates:` and write the literal commands the builder will run between increments. Inspect `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` (or the project's equivalent) during planning and write commands against THIS project's actual stack:

```
# illustrative — substitute the project's actual runner / linter / type-checker
- `<test-runner> <test-file>`     (per-test loop)
- `<type-checker>`                 (after each function added)
- `<linter> --fix`                 (before commit)
- Full suite: `<test-runner>`      (before advance-hat)
```

Concrete examples across common stacks:

- JS / TS: `pnpm test <file>`, `pnpm typecheck`, `pnpm lint --fix`, `pnpm test`
- Python: `pytest <file>`, `mypy --strict src/`, `ruff check --fix`, `pytest`
- Go: `go test <pkg>`, `go vet ./...`, `gofmt -w`, `go test ./...`
- Rust: `cargo test <name>`, `cargo check`, `cargo fmt`, `cargo test`

The plan is not portable to other projects — it's specific to THIS codebase. Pick the project's actual commands; do NOT leave placeholders.

### 6. Sanity-check before handing off

- [ ] Every AC item / `.feature` scenario this unit owns appears in the test mapping table
- [ ] Every file in the change plan has a stated `Why:`
- [ ] Every risk has a mitigation that the builder can act on without further investigation
- [ ] Every verify command is the literal command for this project's stack, not a placeholder
- [ ] The plan does NOT include architecture decisions that weren't already made upstream — if you needed to make one, that's a feedback against the design or inception stage, not a hidden assumption in the plan
- [ ] The plan does NOT exceed one bolt's worth of work — if it does, break the unit before handing off

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** plan without reading the completion criteria, the product hat's AC, and the relevant `.feature` files
- The agent **MUST NOT** plan an implementation that contradicts the data contracts — file feedback against `product` if the contract is wrong, don't quietly diverge in the plan
- The agent **MUST NOT** copy a previous failed plan without changes — the previous failure is the most important input to the retry
- The agent **MUST** identify risks (high-churn, shared code, migrations, cross-cutting concerns) up front, with mitigations
- The agent **MUST NOT** skip the AC → test mapping table — that table IS the TDD baton handed to the builder
- The agent **MUST** write project-specific verify commands, not template placeholders
- The agent **MUST NOT** plan more work than can be completed in one bolt — break the unit instead
- The agent **MUST NOT** make architecture decisions in the plan — those belong upstream; if a decision is missing, file feedback rather than smuggling one in
- The agent **MUST** record the plan's decisions in the unit body where they affect downstream hats — the builder reads the body, not just the frontmatter
