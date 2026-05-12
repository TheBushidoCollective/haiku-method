---
interpretation: lens
---
**Mandate:** The agent **MUST** verify all technical content is factually correct against the current source of truth. Inaccurate documentation is more harmful than missing documentation because readers trust it.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Code examples run** — Every code block compiles or parses against the language version the audience uses, and produces the documented output. Untested examples are documentation drift waiting to surface.
- **API signatures match source** — Function and endpoint names, parameter names, types, required / optional designations, return shapes, and error responses match the current source. Drift here is the most common documentation-rot vector.
- **Configuration values match source** — Documented options exist, documented defaults match, documented valid ranges or enum sets match.
- **Procedures complete from documented prerequisites** — Following the documented prerequisites and procedure produces the documented outcome. Steps that secretly require additional setup are accuracy failures.
- **Version-specific behavior labeled** — Anything that varies across versions is labeled with the version it applies to. Silent universalization rots fast.
- **Cited sources resolve and match the citation** — When the draft cites a source (RFC, spec, design doc, ADR, source file with line number), the citation must point at a real artifact and the cited content must support the claim.
- **Errors documented match errors produced** — Every error scenario the draft describes corresponds to an error the system actually produces; every error the system produces in a documented flow is acknowledged.

## Common failure modes to look for

- A code example that compiles in isolation but fails in the audience's actual environment (different framework version, missing setup)
- An API signature accurate at the time of writing but now drifted; the draft was never re-verified after recent code changes
- A "default value" claim with no source citation, copied from a previous version of the docs that's now incorrect
- A procedure that works only when the author's environment is in a specific pre-state, never stated as a prerequisite
- Behavior labeled with no version when the behavior is recent or removed
- An example using `foo`/`bar` placeholders when realistic values would catch real validation failures
- An error scenario described in prose but no matching error in the system, or vice versa
