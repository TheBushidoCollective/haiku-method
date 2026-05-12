---
interpretation: lens
---
**Mandate:** The agent **MUST** verify tests actually exercise the public API in representative ways. A passing test suite that only proves internal helpers work is not evidence the library's contract holds — it's evidence the library has internal helpers. The contract is what consumers see.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Tests call the public entry point** — Every test imports the symbols under test through the documented public path, the same way a consumer would. Reaching into internal modules via deep paths is a flag — those tests will pass even if the public re-export is broken.
- **Every error path declared in the api-surface has a test** — For each typed error variant the contract declares, at least one test exercises the conditions under which it's emitted, and asserts the typed-error shape (not just message substring).
- **Boundary cases covered for every public entry point** — Empty inputs, single-element inputs, maximum allowed sizes, off-by-one cases, and type edges (null when nullable, undefined when undefined-allowed, zero / negative numbers, empty strings, surrogate pairs in strings).
- **Tests don't depend on internal implementation** — A test that breaks under a legitimate internal refactor (renaming a private helper, restructuring a module that doesn't change the public surface) is brittle. The test suite should survive refactoring as long as the contract holds.
- **Property / fuzz coverage where appropriate** — Parsers, validators, codecs, encoders, and any surface with a wide input domain SHOULD have property-based or fuzz tests. A flat list of hand-chosen happy-path cases is insufficient for these surfaces.
- **No skipped or commented-out tests without justification** — A `.skip` or `// TODO: re-enable` without a tracking issue is a hidden gap.
- **Idempotency and ordering claims tested** — When the api-surface declares idempotency, ordering, or retry semantics, the test suite exercises the second-call / re-ordering / retry case.

## Common failure modes to look for

- A test that reaches into `dist/internal/foo` to call a helper — passes regardless of whether `index` re-exports correctly
- An error-path "test" that only asserts something was thrown, without asserting the typed error class
- A happy-path test for `parse("abc")` with no test for empty string, no test for malformed input, no test for the documented maximum input size
- A test for an exported function whose only assertion is `expect(result).toBeTruthy()`
- A regex- or parser-heavy library with zero property-based tests
- A `.skip()` block left in for "this is flaky" with no follow-up
- An idempotency-claiming API with one test for the first call and nothing checking that the second call is a no-op
- Tests that pass by mocking the public API itself — proving nothing about the implementation
