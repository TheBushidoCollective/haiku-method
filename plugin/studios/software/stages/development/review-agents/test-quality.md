---
interpretation: lens
---
**Mandate:** The agent **MUST** verify tests actually validate behavior, not just exercise code paths. A green test suite that asserts the wrong thing is worse than no tests — it provides false confidence. Coverage is a floor, not a ceiling; what's tested matters more than how much. File feedback for any failure.

## Check

The agent **MUST** verify each of the following:

- **Tests assert behavior, not implementation.** Assertions match the AC / `.feature` outcome (response shape, side effect, user-visible state) — not internal call counts, internal state shape, or "the function was invoked".
- **Test names describe the scenario.** `it("rejects invalid email on signup")` — yes. `it("works")`, `it("test 1")`, `it("calls validate")` — findings.
- **Edge cases from the spec have tests.** Every boundary the AC / `.feature` files identify has a corresponding test. Happy-path-only test suites are a finding.
- **No tautological tests.** Tests that assert on the mocked return value of a mock, tests where the assertion can never fail, tests that pass on first run with no RED state in commit history.
- **Mocks at the right boundary.** External services / IO / time / randomness are mocked. Internal collaborators within the same module are NOT mocked — that hides integration bugs. The default test should exercise the real internal collaboration; mocks live at the system seam.
- **Integration coverage** for system boundaries — API → service → DB integration tests for backend units; component-renders-and-fires-action tests for UI units. Pure-unit tests alone don't prove the seam holds.
- **Realistic test data.** Test fixtures look like production data (real-shaped names, real-shaped emails, real-shaped IDs). `"foo"` / `"bar"` / `1` / `1` for an `id` is acceptable only when the test isn't sensitive to data shape.
- **No skipped / pending tests left in the change.** `it.skip`, `xit`, `it.todo` without a tracking reference is a finding.

## Common failure modes to look for

- A test that does `mockFn.mockReturnValue(42)` then asserts `expect(result).toBe(42)` — confirms the mock works, not the system
- A test whose only assertion is `expect(mockFn).toHaveBeenCalledTimes(1)` — proves invocation, not correctness
- A "happy path" test for a feature with 5 named error cases in the AC, and zero tests for those errors
- A test with a name like `it("works")` or `it("should work")`
- A backend test that mocks the entire service layer — exercising the controller in complete isolation from the system it controls
- A frontend component test that mocks every child component — proves the parent renders something, not that the page works
- A commit history showing the test added in the same commit as the implementation, with no RED → GREEN sequence (TDD violation per the builder hat's mandate)
- A test fixture with `email: "test@test.com"`, `id: 1`, `name: "Test"` — fine for some tests, but a finding when the test exercises name-handling, email-handling, or ID-handling logic
