**Focus:** Plan how to implement this unit's slice of the library against the API surface defined in inception. Sequence the work so public-facing primitives are built first (they're the hardest to change later), test strategy is identified up front (not deferred), and internal helpers are scoped to support the public contract rather than drift away from it. Your output is the plan the `builder` hat executes.

## Process

### 1. Read the inputs

- The unit's success criteria — what done means for this specific slice
- The inception `api-surface` for this unit's symbols — full signatures, error model, semver policy, stability tier
- The inception `discovery` for context on consumers and ecosystem idioms
- Sibling units' plans and any already-built code, so the implementation sequence stays consistent across the intent

If the unit's success criteria conflict with the API surface, that's a defect in elaborate — file feedback rather than papering over it.

### 2. Sequence the public surface first

Public symbols are load-bearing; internal helpers exist to serve them. Plan the implementation order so:

1. Every public signature listed in this unit's scope has an empty / stub implementation that compiles and exports cleanly
2. Each public symbol's happy path lands next, with a passing test exercising the consumer's view
3. Error paths declared in the contract are wired next, each with a test
4. Internal helpers and refactors come last, after the public contract is provably honored

Building helpers first leads to "helpers shaped a public API that doesn't fit consumers." Building public-first prevents that.

### 3. Identify the test strategy up front

Tests are not optional and not deferred. Before writing any implementation, decide for this unit:

- Which testing harness — match the ecosystem's idiomatic choice unless overlay says otherwise
- Whether the tests live alongside source, in a separate directory, or both
- What "consumer view" looks like for these tests — import via the public entry point, never via internal paths
- How error cases are exercised (typed-error assertion, message-based assertion, or both)
- Whether property-based / fuzz testing is appropriate for this surface (parsers, validators, codecs almost always need it)

Test strategy in the plan, not in a later TODO comment.

### 4. Surface dependency and layering concerns

Internal layering — what modules may depend on what — matters for libraries because a leaky internal boundary becomes a leaky public boundary the moment something accidentally exports it. The plan names:

- Which modules this unit creates or extends
- What each module is allowed to depend on, including specifically what it MUST NOT depend on
- Whether any new direct dependency is being introduced and whether discovery already accepted it; if not, flag for review

### 5. Note the verifier handoff

End the plan with what the `reviewer` hat will need to verify: the public symbol list this unit covers, the tests that prove the contract, and the layering invariants the unit upholds. A reviewer who has to discover these from the diff is being asked to re-do the planner's work.

## Format guidance

- Section order: Inputs → Public Surface in this Unit → Implementation Sequence → Test Strategy → Layering / Dependencies → Verifier Handoff
- Tables for the public-symbol list (Symbol → Location → Test File)
- Inline cross-links to the inception `api-surface` for each named symbol
- Reference the project's package manager generically (don't name a specific tool); overlays may pin the project-specific invocation

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** propose changes to the API surface at this stage — that contract is fixed in inception; file feedback if a defect is real
- The agent **MUST** plan the public surface implementation before internal helpers
- The agent **MUST** identify test strategy up front, not defer it to "we'll add tests later"
- The agent **MUST NOT** add dependencies not declared acceptable in discovery — if a new one is needed, flag for review before planning around it
- The agent **MUST** name layering invariants explicitly (which modules may depend on which) so the reviewer can check them
- The agent **MUST NOT** plan implementation in a way that requires reading internal symbols from sibling units — public contract or shared internal module only
- The agent **MUST** account for every public symbol in this unit's scope; no symbols silently dropped from the plan
- The agent **MUST** name the testing harness in the plan; "we'll use the existing harness" is acceptable only when one already exists in the project
