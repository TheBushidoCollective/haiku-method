---
name: release
description: Publish, changelog, documentation, and deprecation policy
optional: true
hats: [release-engineer, doc-writer, verifier]
fix_hats: [classifier, release-engineer, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: inception
    discovery: discovery
  - stage: development
    output: code
---

# Release

Publish the built library to its registry, generate the changelog, update the documentation, and manage the deprecation lifecycle. Libraries don't deploy — they publish, and publishing is one-shot: once a version resolves in the registry it can't be unpublished without breaking every consumer who already pulled it. A broken release is a new patch version, not a rollback.

## Scope

Turning built code into a published version — semver decision, changelog, registry publish, git tag, docs update, deprecation policy, and post-publish smoke install. Release decides *how the work reaches consumers and how the version is communicated* — not what was built (development) or whether it's safe (security), though it surfaces the security guidance and the semver impact those stages produced.

## What to do

- Decide the semver impact by diffing the new public surface against the prior one, and write the changelog entry that explains it.
- Update the documentation to match the release — API reference, migration guides for breaking changes, and the security guidance integrated into the relevant sections.
- Prepare an unambiguous publish action with a mechanically decidable post-condition (the smoke install confirming the version resolves and imports).
- Honor the deprecation policy when retiring surface, so consumers get warning before removal.

## What NOT to do

- Don't publish a breaking change under a patch or minor bump — the semver math is a hard constraint, not a preference.
- Don't redefine or reimplement the library here; release publishes what development built.
- Don't ship a release whose smoke install hasn't been confirmed.
- Don't remove public surface without the deprecation path the policy requires.
