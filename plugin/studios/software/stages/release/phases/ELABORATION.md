# Release Stage — Elaboration

Release is an **operational** stage. Its units are operational steps in the publish-to-registry pipeline — discrete actions with preconditions, an action procedure, and post-condition checks. Libraries publish; they don't deploy. There is no on-call rotation; a broken release is corrected with a new patch version.

## What a unit IS in this stage

One operational step in the publish pipeline. Examples:

- "Version bump and changelog generation — semver decision, CHANGELOG.md entry"
- "Registry publish — npm/PyPI/crates.io/Maven Central publish action with credentials"
- "Tag and release notes — git tag, GitHub/GitLab release with assets attached"
- "Documentation site deploy — docs build, site preview, prod swap"
- "Deprecation notice — for any removed API, ship the deprecation in the prior minor first"
- "Post-publish smoke install — new project pulls the published version and runs a hello-world script"

What a unit is **NOT** in this stage:

- ❌ A new feature (that belongs in `development`)
- ❌ A security audit (that belongs in `security`)
- ❌ An API surface decision (that belongs back in `inception`)

## What "completion criteria" means here

Operational-step criteria specify **preconditions, action, post-condition check, and rollback** (or explicit "no rollback — patch forward" rationale).

### Good criteria — concrete and verifiable

- "Registry publish post-condition: `npm view <pkg>@<version>` returns the new version within 5 minutes of `npm publish`"
- "Smoke-install post-condition: a new throwaway project can `npm install <pkg>@<version>` AND import + call the documented hello-world API without errors"
- "Changelog post-condition: CHANGELOG.md has a `## [<version>] - <YYYY-MM-DD>` heading with at least one entry under Added/Changed/Fixed; CI lints this"

### Bad criteria — vague or wrong-stage

- ❌ "Library is published" (no check against the registry)
- ❌ "Version is correct" (correct by what rule?)
- ❌ "API works" — wrong stage; that's a `development` concern

## How verification happens

Release artifacts are validated by the verifier hat (`hats/verifier.md`). The verifier checks **preconditions stated, action unambiguous, post-condition mechanically decidable, deprecation policy honored where applicable** — body-content checks only, no frontmatter interpretation.

## Anti-patterns

- **Skipping the smoke install.** "Published successfully" with no post-publish install test is how you find out later that the package was published with the wrong files / missing entry point / bad shape.
- **Skipping the deprecation step.** Removing a public API in a major without a deprecation in the prior minor is a contract break. The verifier should reject any release unit that removes API without a recorded deprecation in the prior version.
- **Treating registry publish as atomic.** Publish + tag + docs + smoke-install are separate operational steps; lumping them as "ship it" loses the audit trail when one of them silently fails.
