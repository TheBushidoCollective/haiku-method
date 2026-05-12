---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the implementation matches the API surface contract and the unit's completion criteria. Correctness gaps that slip past this lens become user-reported bugs in shipped versions — and once a buggy version is in the registry, the only fix is a new patch.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Every exported symbol matches the api-surface entry** — Name, parameter list, parameter types, return type, generic constraints, optional designation, and default values are an exact match between code and inception artifact.
- **Error model implementation matches** — Each public operation throws / returns only the typed error variants declared. No variant emitted that isn't documented; no documented variant unreachable in practice.
- **No undeclared public exports** — Every name reachable through the library's public entry point is in the api-surface. Anything reachable but undeclared is either a leak (flag as a layering / surface issue) or a missed entry in inception (file feedback there).
- **Completion criteria are met** — Every checkbox-style item in the unit's success criteria has a corresponding implementation or test that satisfies it. Quality-gate commands (lint, type-check, test, build) pass when run through the project's package manager.
- **Documented invariants hold** — When the api-surface or the unit body states an invariant (idempotency, ordering, thread-safety, retry behavior), the implementation upholds it and a test demonstrates it.
- **Cross-runtime claims honored** — If the unit's surface is declared cross-runtime, no implementation path uses a runtime-specific primitive that would silently fail on another supported target.

## Common failure modes to look for

- A parameter type subtly widened or narrowed compared to the api-surface (`string | number` in code, `string` in inception, or vice versa)
- An error variant that the contract declares but no code path emits — declared-but-unreachable errors mislead consumers
- A test that "passes" by accident because the assertion is too weak (asserts truthiness instead of a specific value)
- An exported helper used internally that wasn't supposed to be public — discoverable via auto-completion even if not documented
- A completion-criteria item left implicit ("performance is acceptable") with no measurement
- An idempotency claim with no test exercising the second-call case
- A retry-semantics claim with no test for the failure-then-success case
- A documented thread-safety / concurrency claim with no concurrent test
