---
name: development
description: Implement the library against the API contract from inception
hats: [planner, builder, reviewer]
fix_hats: [classifier, builder, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: inception
    discovery: discovery
  - stage: inception
    discovery: api-surface
---

# Development

Implement the library against the public API surface defined in inception: working code and the tests that prove the contract holds. Public API stability is a hard constraint — internal refactoring is free, but any change to the documented signature requires explicit review and a semver bump the release stage will surface to consumers.

## Scope

Implementation against the API contract — the source, the tests that prove it, and the internal architecture decisions that fall out along the way. Development decides *how the contract is built* — not what the contract is (inception), how it's published (release), or its threat model (security). Public signatures are honored as given unless a change is explicitly reviewed.

## What to do

- Implement each unit against the API surface and its success criteria, with public-facing primitives landing before internal helpers.
- Write the tests that prove the contract holds alongside the implementation, keeping the build and tests green as you go.
- Keep internal symbols clearly separated from the public surface so the boundary stays legible.
- Match the project's existing patterns and conventions rather than introducing your own.

## What NOT to do

- Don't change a documented public signature without explicit review and the semver bump it implies.
- Don't reinterpret the API contract to fit the code — a wrong contract is a revisit to inception, not a quiet change here.
- Don't add scope the success criteria don't call for.
- Don't advance with failing tests, failing gates, or a criterion left unproven.
