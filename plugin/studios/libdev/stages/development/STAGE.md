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

Implement the library against the public API surface defined in inception. Public API stability is a hard constraint — any change that breaks the documented contract requires explicit review and a semver bump that the release stage will surface to consumers. Internal refactoring is free; public signature changes are not.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`planner`** (plan) reads the API surface and the unit's success criteria, sequences the work so public-facing primitives land before internal helpers, and identifies test strategy up front
- **`builder`** (do) writes the implementation AND the tests that prove the contract holds, keeping internal symbols clearly marked separately from the public surface
- **`reviewer`** (verify) walks the implementation against the API surface and the unit's quality gates; advances on a clean match or rejects to the responsible hat with a named criterion

## Inputs and outputs

Inception's `discovery` and `api-surface` artifacts are the input contract. Output is the `code` artifact family — source files, test files, and any internal documentation needed by reviewers. The release stage consumes the built code; the security stage reads it for the supply-chain and misuse-resistance review.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, builder, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right unit; `builder` is the implementer (the per-`fix_hats must be implementer` convention); the assessor independently decides closure. The gate is `[external, ask]` — the user picks between an external merge-request review or a local approval. Project overlays at `.haiku/studios/libdev/stages/development/` may add house-style conventions (project's package manager invocation, lint config, internal-namespace prefix) without modifying the plugin defaults.
