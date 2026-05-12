**Focus:** Update the library's public documentation to reflect the release. API reference, migration guides for breaking changes, surfaced security guidance, and consumer-facing release notes are part of the contract — undocumented changes are bugs. Documentation lands BEFORE the release is announced, never after; consumers searching the docs after upgrading need accurate guidance immediately.

## Process

### 1. Inventory what changed

Walk the changelog entry the release-engineer wrote. For each line:

- Identify the documentation surfaces affected — API reference page(s), guide pages, examples, README, FAQ
- Note whether the change requires a new page (new feature with conceptual guide) or an edit to an existing page
- Flag breaking changes that need migration guides

Documentation drift comes from changes shipping faster than docs. A complete inventory up front prevents that.

### 2. Update the API reference

For each public symbol added, changed, or removed:

- **Added**: full signature, parameter explanations, return-value description, error variants, idiomatic example, version-added annotation
- **Changed**: update signature / behavior description, add a "Changed in vX.Y.Z" annotation, ensure the description matches the new behavior
- **Removed**: replace the entry with a deprecation / removal notice that points to the migration guide

Type signatures in docs MUST match the type signatures in the code, byte-for-byte except for prose annotations. Drift between docs and types is a contract break.

### 3. Write migration guides for breaking changes

For every breaking change in this release:

- Before / after code examples
- Step-by-step migration procedure
- Estimated effort qualitatively ("trivial — rename one import", "moderate — restructure error handling", "significant — re-architect callers")
- Workaround / shim availability if any
- Cross-link from the changelog's Breaking section AND from the affected API reference pages

A breaking change without a migration guide is a release blocker.

### 4. Integrate security guidance into the API surfaces it concerns

Security-relevant guidance from the security stage MUST land in the API reference pages where consumers will see it, not buried in a separate security page. If a function has consumer-misuse-resistance guidance, the function's reference page surfaces it; the security page is a useful index, not the primary delivery channel.

### 5. Update narrative content where the surface changed

README, getting-started guide, examples, FAQ — anywhere consumers form their first impression of the library — must reflect the current public surface. If the new release renames the most-recommended entry point, every example using the old name needs an update or a deprecation note.

## Format guidance

- Follow the project's existing documentation conventions (page structure, code-block syntax, link patterns) — consistency over personal preference
- Version-added / changed / deprecated annotations on every entry that's been touched
- Migration guides live at a stable URL referenced from changelog and release notes
- Cross-references between API reference, narrative guides, and the changelog so consumers can navigate from any entry point
- Use generic terms like "the project's documentation platform" or "the docs site"; overlays specify the actual tooling

## Anti-patterns (RFC 2119)

- The agent **MUST** update docs before announcing the release, not after
- The agent **MUST NOT** ship breaking changes without a migration guide
- The agent **MUST** integrate security guidance into the relevant API sections, not bury it in a security page consumers won't find until after a breach
- The agent **MUST NOT** let type signatures in docs drift from type signatures in code — they are the same contract in two surfaces
- The agent **MUST** add version-added / changed / deprecated annotations for every entry touched by this release
- The agent **MUST NOT** copy code examples from old docs without re-running them against the new surface
- The agent **MUST** update README and examples when the most-recommended entry point changes
- The agent **MUST NOT** ship documentation that contradicts the changelog or the release notes — same facts, three audiences
- The agent **MUST** describe credentials, environment, and tooling generically — overlays pin specifics
- The agent **MUST NOT** assume training-data knowledge about the documentation platform's syntax — verify against the project's existing pages
