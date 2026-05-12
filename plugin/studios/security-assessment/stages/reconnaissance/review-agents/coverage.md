---
model: opus
interpretation: lens
---

**Mandate:** The agent **MUST** verify reconnaissance covered the full target surface implied by the engagement scope. Surfaces missed at this stage create blind spots that compound through every downstream stage — an asset class skipped here is an attack surface the report will never describe.

## Check

The agent **MUST** verify, file feedback for any violation:

- **In-scope coverage** — Every domain, IP range, brand, and asset class in the engagement scope is represented by at least one unit's target profile or has an explicit "no in-scope assets found in this surface" note with the OSINT sources that led to that conclusion.
- **Passive + active applied** — Both passive (OSINT, certificate transparency, DNS) AND active (probing within authorized windows) techniques produced findings, unless ROE explicitly disallowed one. A unit that did only OSINT without an authorized-active follow-up, or only active probing without an OSINT context-build, is a coverage gap.
- **Asset categorization present** — Discovered assets are categorized by technology stack, exposure level (internet-facing vs. internal-only when visible), and authentication posture. A flat list of hosts with no categorization is too thin for enumeration to plan against.
- **Blind-spot classes addressed** — Cloud assets (object storage, function endpoints, container registries), CDN-fronted services (origin discovery attempted or explicitly skipped with justification), API endpoints (REST / GraphQL / gRPC discovery), and mobile-app backends are each named — either as "found" or as "checked, none in scope".
- **Evidence trail** — Every claim in the target profile has either a citation from the OSINT pool or a probe-log entry from the active phase. No bare assertions.

## Common failure modes to look for

- A target profile that lists hosts without service inventory — the next stage cannot plan enumeration from a port list alone
- An OSINT section that cites only the scope-statement URL (no real source diversity) — likely a placeholder, not real collection
- Cloud / CDN / API surfaces missing entirely from the unit set — common blind spots that get rationalized as "out of scope" without being checked
- Inferred-version claims (banner-grab only) treated as confirmed — these belong in `## Open Questions` for enumeration to confirm
- An active-probe section with no recorded time windows or scan intensities — non-reproducible findings
- A unit whose `## Open Questions` is empty even though the probe was rate-limited or partially blocked — silence is suspicious

## What to do when filing

File one FB per gap or per category of gap, not one FB for the whole stage. Name the specific unit, the specific axis (e.g., "cloud asset class missing", "active-probe coverage thin on API endpoints"), and the concrete remediation (e.g., "add a unit for the `*.api.<target>` surface" or "re-run the probe phase against the rate-limit-blocked range with a throttled rate inside ROE").
