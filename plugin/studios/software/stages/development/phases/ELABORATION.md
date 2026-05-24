# Development Stage — Elaboration

## Cross-unit dependencies and gate isolation (CRITICAL)

Each unit runs in an **isolated worktree** forked from the stage branch. A sibling unit's code is **not present** until that sibling merges. Two rules follow, and they are the difference between a unit that converges and one that burns its whole bolt budget on an unsatisfiable gate:

1. **Declare cross-unit prerequisites in `depends_on:` — never leave them in prose.** If a unit reads another unit's output, reuses its module, or needs its merged code to satisfy the gate, that producing unit goes in `depends_on:`. The wave scheduler sequences **only** on `depends_on:` — a dependency you mention in the plan ("reuses unit-008's `createOrder`", "until unit-002's schema lands") but don't declare is invisible to the scheduler. The unit gets co-scheduled with its own dependency, runs before it merges, and is handed inputs that don't exist yet. **A plan that says "stub it until unit-X merges" is the symptom of a missing `depends_on:` edge** — declare the edge instead of writing the stub.

2. **The completion gate must pass in the unit's isolated worktree, at the time the unit runs.** If the gate runs tests that need a sibling's unmerged schema or module, it cannot exit 0 in isolation — and faking the whole dependency with in-memory stubs is not isolation, it's testing the stub. When a gate would depend on a sibling, either:
   - **declare that sibling in `depends_on:`** so this unit runs *after* it merges and the gate is genuinely satisfiable, or
   - **scope the gate** to the tests that pass in isolation (pure logic, this unit's own surface) and let an integration unit — one that declares `depends_on:` on every unit it exercises — own the cross-unit assertions.

   A gate that can only pass once a sibling merges, with no `depends_on:` to enforce that ordering, is not a gate — it's a unit scheduled to fail.

## Criteria Guidance

The verify-command examples below illustrate the **pattern**. Map them to the project's actual stack — read `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` during elaboration to know which test runner, coverage tool, and linter the project uses, then write the gate against that.

### Good — criterion paired with verifying command

- "All API endpoints return correct status codes for success (200/201), validation errors (400), auth failures (401/403), and not-found (404)"
  - JS/TS: `pnpm test --run api/contracts.test.ts` exits 0
  - Python: `pytest tests/api/test_contracts.py` exits 0
  - Go: `go test ./api/contracts_test.go` exits 0

- "Test coverage is at least 80% for new code"
  - JS/TS: `pnpm coverage --check 80` exits 0
  - Python: `pytest --cov --cov-fail-under=80` exits 0
  - Rust: `cargo tarpaulin --fail-under 80` exits 0

- "No type-evasion in new code (typed-language equivalents of unsafe escape hatches)"
  - TS: `! grep -rnE ': any\b' --include='*.ts' src/ | grep -v '// eslint-disable.*no-explicit-any'`
  - Go: `! grep -rnE 'interface\{\s*\}' --include='*.go' .`
  - Python: `mypy --strict src/` exits 0

### Bad — vague (no clear check)

- "API works correctly" — what does correctly mean?
- "Tests are written" — how many? Which scenarios? What coverage?
- "Types are correct" — passes the type-checker? No escape hatches? No casts?
