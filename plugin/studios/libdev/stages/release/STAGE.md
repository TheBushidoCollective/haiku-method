---
name: release
description: Publish, changelog, documentation, and deprecation policy
hats: [release-engineer, doc-writer, verifier]
fix_hats: [classifier, release-engineer, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: inception
    discovery: discovery
  - stage: inception
    discovery: api-surface
  - stage: development
    output: code
---

# Release

Publishing to the target registry, generating changelogs, updating the documentation site, and managing the deprecation lifecycle. Libraries don't deploy — they publish. There is no on-call, no rollback in the traditional sense; a broken release means a new patch version, not a redeployment. The act of publishing is one-shot — once a version is in the registry it cannot be unpublished without breaking every consumer who already resolved it.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`release-engineer`** (plan / do) decides the semver impact, writes the changelog entry, prepares the registry-publish action, tags the commit, and lines up the post-publish smoke install
- **`doc-writer`** (do) updates the public documentation site to reflect the release — API reference, migration guides for breaking changes, surfaced security guidance integrated into the relevant API sections
- **`verifier`** (verify) validates the operational artifacts: preconditions stated, action unambiguous, post-condition mechanically decidable, deprecation policy honored

## Inputs and outputs

Inputs are inception's `discovery` and `api-surface` (for context and semver diffing) plus development's `code` (the actual artifact to publish). Output is the `release-artifacts` family — version bump, changelog entry, signed registry publish, git tag, docs deploy, smoke-install record.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, release-engineer, feedback-assessor]` dispatches per finding. The gate is `auto` — release artifacts are mechanically verifiable (semver math, changelog completeness, smoke install) so the engine signs off when the verifier and review agents pass. Project overlays at `.haiku/studios/libdev/stages/release/` may add house-style conventions (changelog headings, release-note templates, doc-site path scheme) without modifying the plugin defaults.
