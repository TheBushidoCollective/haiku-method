**Focus:** Publish the library to its target registry with a correct semver version, a complete changelog, signed artifacts, and the operational metadata consumers depend on (git tags, release notes, provenance). Publishing is one-shot — once a version is in the registry, it's effectively immutable. Get it right before pressing publish; a broken release means a new patch version, not a redeployment.

## Process

### 1. Diff the surface and decide the semver bump

Compare the implemented public API surface against the prior released version's api-surface. For each category of change:

- Any removed, renamed, or signature-changed public symbol → **major**
- Any closed error-set addition, any behavior change on an existing entry point → **major**
- Any new export, new optional parameter, new error variant in a non-exhaustive set → **minor**
- No public surface change; internal-only fix → **patch**

Record the diff and the decision in the unit body. If multiple categories are present, the highest applicable bump wins. Pre-1.0 libraries follow the same rules; pre-1.0 ≠ "any bump is fine."

### 2. Author the changelog entry

Write the entry in consumer terms, not internal refactoring language. Group entries by impact:

- **Breaking** (or equivalent heading per project convention) — what removed / renamed / changed; named migration guide reference
- **Added** — new exports, new options, new error variants
- **Changed** — behavior changes (observable but not signature-changing); call out semver impact explicitly
- **Fixed** — bug fixes, with one-line description of what symptom is gone
- **Security** — security-relevant fixes, severity, and consumer guidance link

The release stage's `changelog-quality` review agent will lint this — pre-emptively check that every public-surface change has a line.

### 3. Prepare the registry publish action

Operational steps the unit's body MUST name:

- Version bump applied in the project's manifest file
- Build / package step succeeds locally (use the project's package manager — overlays pin the exact command)
- Artifacts produced are the right shape: declared entry points exist, declared types exist, dual-publish targets present if claimed, peer-dependency ranges correct
- Credentials / signing — name the credential source and signing mechanism without embedding secrets

Do not run the publish action from the unit body. Operational steps describe the procedure; execution is a separate concern owned by the project's release tooling.

### 4. Tag and release notes

- Git tag the commit matching the published artifact, named per project convention (`v1.2.3` typically)
- Release-notes draft per project convention — usually a curated narrative version of the changelog entry, surfacing the most important changes for consumers
- Attach reference artifacts (build outputs, type declarations, signed checksums) where the hosting platform supports release assets

### 5. Plan the post-publish smoke install

A release isn't done until a fresh consumer can install and use it. The smoke-install step:

- Spin up a throwaway project on a clean cache
- Install the published version via the project's package manager
- Import and call the documented hello-world API
- Assert no errors, correct entry-point shape, correct types resolved

If smoke install fails, the release is broken — file feedback against this unit, ship a patch with the fix, and document the failure.

## Format guidance

- Operational-step structure: Preconditions → Action → Post-condition check → Rollback (or "no rollback — patch forward" with rationale)
- Tables for the surface diff (Symbol → Change → Bump impact)
- Concrete post-condition checks: "the published version is resolvable from the registry within 5 minutes of publish, verified by querying the registry's package metadata endpoint"
- Reference the project's package manager / registry tooling generically; overlays specify the exact tool

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** publish if the version number doesn't match the semver impact of changes
- The agent **MUST NOT** skip the changelog entry — consumers depend on it for upgrade decisions
- The agent **MUST NOT** publish if the security stage has unresolved high-severity findings without consumer guidance and a release-notes call-out
- The agent **MUST** tag the git commit matching the published artifact
- The agent **MUST NOT** publish if any documented breaking change lacks a migration guide
- The agent **MUST NOT** treat publish, tag, docs deploy, and smoke install as a single atomic step — each is its own operational unit
- The agent **MUST** include a post-publish smoke install whose success is a precondition for declaring the release complete
- The agent **MUST NOT** skip the deprecation step — removing a public API without a deprecation in the prior minor is a contract break even if the major bump is otherwise correct
- The agent **MUST** describe credentials and signing mechanisms without embedding the credentials themselves
- The agent **MUST NOT** rely on training-data assumptions about registry rate limits, version reservation rules, or unpublish policies — cite the registry's current documentation
