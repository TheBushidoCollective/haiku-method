---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the changelog entry for this release is complete, accurate, and useful to consumers deciding whether to upgrade. The changelog is a contract — when consumers grep for "Breaking" before upgrading, they're trusting it to be exhaustive.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Every public-surface change has a changelog line** — Diff this release's api-surface against the prior released version. Every added, removed, renamed, or signature-changed export appears as a changelog entry. Silent surface changes are the highest-priority finding.
- **Breaking changes are marked clearly** — Breaking changes appear under a dedicated heading (or are tagged inline per project convention) so consumers can find them with a single scroll or `grep`. Breaking changes scattered across other sections fail this check.
- **Security-relevant changes labeled** — Any fix that addresses a security finding from the security stage appears under a Security heading or with an explicit Security label, with a one-line description of the impact (no exploit details) and a link to the advisory or consumer guidance.
- **Consumer-language descriptions** — Entries describe what changes for the consumer, not what changed internally. "Renamed `parseFoo` to `parse`" beats "refactored parser entry point"; "fixed off-by-one in pagination cursor" beats "minor parser fix."
- **Format matches project convention** — Existing changelog format (Keep a Changelog, custom, etc.) is preserved. New sections, new tag conventions, new ordering all fail this check unless overlay says otherwise.
- **Deprecation lifecycle visible** — APIs deprecated in this release appear under Deprecated; APIs removed in this release that were deprecated in the prior minor cite the prior deprecation entry.
- **Version + date present** — The release heading includes both the version number and the date in the project's documented format. Skipping the date breaks chronological scanning.

## Common failure modes to look for

- A new export shipped without a changelog line — visible only by diffing the manifest
- A "minor refactor" entry that hides a behavior change in an existing API
- Breaking changes listed in the Changed or Fixed section instead of Breaking
- A security fix described only as "fixed bug" with no security label
- Internal language ("refactored the dispatcher loop") instead of consumer language ("retry behavior now respects the `retry-after` header")
- An API removed in this release with no corresponding deprecation entry in the prior minor's changelog
- Multiple changes lumped into a single bullet point so consumers can't grep for any one of them
- A version heading missing the release date, or using a non-standard date format
