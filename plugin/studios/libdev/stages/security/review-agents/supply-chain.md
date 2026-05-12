---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the library's dependency tree is audited and free of known-vulnerable dependencies before release. Supply-chain risk is the single most common path from "small library" to "downstream incident" — a vulnerable transitive dependency a consumer never chose is still the library's problem.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Audit tool has run against the current tree** — The ecosystem's audit tool (the project's package manager's audit subcommand, or an equivalent advisory tool) has been executed against the dependency tree this release ships. The run output is captured in the unit body or linked, with timestamp.
- **HIGH / CRITICAL findings addressed** — No direct dependency has a known HIGH or CRITICAL advisory without one of: a remediation in this release (bumped to a patched version), a documented mitigation with concrete consumer guidance, or an explicit accepted-risk rationale recorded in the release notes.
- **Transitive risks assessed** — Audit walks the full tree, not just direct dependencies. Transitive HIGH / CRITICAL findings have a remediation plan even when the library cannot upgrade them directly (force-resolution, vendoring, lifting the constraint upstream).
- **Licenses compatible** — Every dependency's license is compatible with the library's declared license. Copyleft dependencies in a permissive library are surfaced explicitly. License changes in dependency upgrades are flagged.
- **Maintenance signal present** — Any dependency with no upstream activity for a long period — no commits, no advisories addressed, no responsive issue triage — is flagged as a supply-chain risk even without a current advisory. Unmaintained code becomes vulnerable code.
- **Build reproducibility / provenance** — When the ecosystem supports signed artifacts and build provenance, this release uses them. When it doesn't, the unit names the alternative attestation (checksum publication, tag signing).
- **No phantom or dependency-confusion exposure** — Internal-name-prefixed packages used in the build do not collide with public registry names; private dependencies aren't accidentally resolvable from the public registry.
- **Peer-dependency ranges sane** — Peer-dependency version ranges are wide enough to be usable but narrow enough to exclude known-bad versions of the peer.

## Common failure modes to look for

- An audit run from before the most recent dependency bump — stale findings, missing fresh ones
- A HIGH advisory dismissed as "doesn't affect us" without naming the code path that makes it unreachable
- A transitive CRITICAL with a "we'll fix it next release" comment and no actual tracking
- A copyleft dependency in a permissive library introduced as a transitive without anyone noticing
- A dependency with no upstream commits and no responses to advisories, treated as fine because no advisory yet exists
- An audit step that only walks direct dependencies, missing the actual risk surface
- A signed-artifact claim that points to a signing setup that hasn't run successfully
- A peer-dependency range pinned to a single major that excludes the most-deployed minor for "stability" reasons — friction for consumers, no security benefit
- A package name choice that shadows a public registry name an attacker could squat
