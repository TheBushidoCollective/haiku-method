---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the release version number correctly reflects the semver impact of changes since the prior release. A wrong bump is one of two contract breaks: a missed major leaves consumers with silently broken pinning; a gratuitous major forces churn for nothing.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Surface diff justifies the chosen bump** — Diff the implemented api-surface against the prior released version. Confirm that the highest-impact change category matches or is below the chosen bump (major beats minor beats patch).
- **Major bump for any removed / renamed / signature-changed public symbol** — Including signature changes that look minor: narrowed parameter type, widened return type, parameter renamed, default value changed in a consumer-observable way.
- **Major bump for closed error-set changes** — Adding an error variant to a typed union the api-surface declared closed (exhaustive) is a major change. Removing or renaming an error variant is always major.
- **Major bump for behavior changes on existing entry points** — Same signature, different observable behavior (stricter validation, changed defaults, different ordering, different idempotency semantics) is a major change. The signature is not the whole contract.
- **Minor bump for additions-only changes** — New export, new optional parameter that doesn't shift positional callers, new error variant in a non-exhaustive (open) error set. None of these break existing code.
- **Patch bump only when no public surface changed** — Internal fix, dependency-only bump, documentation-only release. Any public-surface delta disqualifies a patch.
- **Pre-1.0 versions follow the same rules** — Pre-1.0 is not "any bump is fine." Pre-1.0 just means the major is zero; minor bumps should still be additive and patches should still preserve the surface. The project's documented pre-1.0 policy (if any) overrides this default.
- **Prior deprecations honored** — An API removed in this release must have been deprecated in the prior minor release. A major bump that removes a non-deprecated API is flagged even if the bump itself is correct.

## Common failure modes to look for

- A "minor refactor" patch release that quietly changes the default value of a public option
- A minor bump that adds a new required parameter to an existing function ("but no one uses that path")
- A patch bump that "just adds a new export" — additions are minor, not patch
- A major bump that removes an API never marked deprecated
- A behavior change shipping as a patch because the signature didn't change
- An error type removed from the union with no major bump because the union was "obviously open"
- A pre-1.0 release where every bump is a major because "we can change anything"
- A bump derived from internal change classification (story points, perceived complexity) rather than surface-diff classification
