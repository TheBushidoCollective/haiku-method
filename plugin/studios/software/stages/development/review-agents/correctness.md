---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the implementation correctly satisfies the behavioral specification and completion criteria. Correctness is non-negotiable — the whole point of the product stage's AC + `.feature` files is to define correct, and this lens checks that the code lives up to that contract. File feedback for any failure.

## Check

The agent **MUST** verify each of the following:

- **Acceptance criteria coverage.** Every AC item from the product stage's `ACCEPTANCE-CRITERIA.md` that this unit owns has a corresponding implementation path AND a passing test. Approximation is a finding — "close enough" is not implemented.
- **`.feature` scenario coverage.** Every Gherkin scenario this unit owns has a passing test that exercises the same precondition / action / outcome. Step definitions that no-op past assertions are findings.
- **Error-state handling.** The error scenarios from the AC and the `.feature` files (auth failure, validation failure, permission failure, not-found, conflict, rate-limit) are each implemented with the right error code and error shape from `DATA-CONTRACTS.md`. Generic `500` for everything is a finding.
- **Data-contract conformance.** Request fields, response fields, types, nullability, and validation match `DATA-CONTRACTS.md` exactly. A field declared `required: yes` that the implementation tolerates as missing is a finding.
- **Edge cases.** Boundary conditions from the AC (empty list, single item, maximum allowed, off-by-one, zero, negative, overflow) are exercised by tests AND handled correctly.
- **No silent failures.** Operations that can fail either return a typed error / Result or throw — they don't swallow exceptions, return `null` ambiguously, or `console.log` and continue.
- **Concurrency correctness** when the unit touches shared state — race conditions are addressed (DB transactions, locks, idempotency keys, optimistic concurrency control) per the data contract.

## Common failure modes to look for

- An AC item ("Display error toast when save fails") implemented as a `console.log` with no UI surface
- A Gherkin scenario `Then I see an error message "<message>"` matched by a test that asserts on any thrown exception — no UI assertion, no message assertion
- Response shape diverging from `DATA-CONTRACTS.md` (extra fields leaked, required fields missing, types differ)
- A validation rule from `.feature` (`Form rejects invalid email`) implemented client-side only — the server still accepts it
- Off-by-one in pagination boundaries (page 1 returns 0 items, page 0 returns the wrong slice)
- An error-handling block that catches a broad `Error` / `Exception` and returns generic `500` — losing the specific error class needed by the caller
- A unit that compiles and tests pass but the behavior under the actual `.feature` scenario was never wired up (test was wrong / mocked the wrong thing)
