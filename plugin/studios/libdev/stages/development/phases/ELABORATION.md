# Development Stage — Elaboration

## Criteria Guidance

The verify-command examples below illustrate the **pattern**. Map them to the library's actual stack — read `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` during elaboration to know which test runner, coverage tool, and linter the library uses, then write the gate against that.

Public API stability is the cross-cutting constraint here — every gate must distinguish the public surface from internal helpers, because a passing test against an internal symbol means nothing if the public signature drifted.

### Good — criterion paired with verifying command

- "Public API surface from inception's `api-surface` artifact compiles unchanged against the new build"
  - JS/TS: `pnpm build && pnpm test --run public-api.test.ts` exits 0
  - Python: `python -c 'from <pkg> import *; print(dir())' | diff - tests/fixtures/expected-symbols.txt`
  - Rust: `cargo doc --no-deps && cargo test --test public_api` exits 0

- "Every public function has a matching test that exercises the documented contract (happy path + at least one error path)"
  - JS/TS: `pnpm test --coverage src/public/` and `pnpm coverage --check-by-file 100 src/public/` exit 0
  - Python: `pytest tests/public/ --cov=<pkg>/public --cov-fail-under=100` exits 0
  - Rust: `cargo test --test public --no-fail-fast` exits 0

- "No internal symbols leak into the public surface"
  - JS/TS: `! grep -rnE '\bexport\s+(const|function|class)\s+_' --include='*.ts' src/public/`
  - Python: `! grep -rnE '^from \.\._internal' --include='*.py' src/<pkg>/__init__.py`
  - Rust: `! grep -rnE '^pub use crate::internal' --include='*.rs' src/lib.rs`

- "Semver impact is named in the unit body" — paired with a manual classification (major / minor / patch) the release stage reads at gate time.

### Bad — vague (no clear check)

- "Library works correctly" — against what consumer? what contract?
- "Public API is stable" — proven how? Diffed against what reference?
- "Tests cover the implementation" — coverage threshold? Against the public surface or the whole codebase?
- "Internal refactoring is fine" — true, but not a gate. Either drop or pair with a `! grep` rule that catches leaks.

## Per-unit framing

Each unit's `## Completion criteria` lists the goal-prose; the executable check lives in `quality_gates:` frontmatter. The `## Implementation notes` section (if present) is for sequencing and constraint context, not for re-prescribing what `quality_gates:` already enforces.

Cross-stage: inception's `discovery/api-surface.md` is the contract this stage builds against. If a unit needs a public-signature change, the unit body MUST state it explicitly and the release stage MUST flag the semver bump.
