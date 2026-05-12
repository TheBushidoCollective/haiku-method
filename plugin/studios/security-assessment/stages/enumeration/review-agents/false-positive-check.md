---
interpretation: lens
---

**Mandate:** The agent **MUST** verify vulnerability-catalog entries are real findings, not scanner noise. Every false positive that survives this lens becomes wasted PoC effort in exploitation and, worse, a deliverable item in the customer report that doesn't stand up to scrutiny.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Confidence rating present and honest** — Every finding has `confidence: confirmed | likely | speculative`. "Confirmed" is reserved for findings that observed-behavior corroborated; banner-only matches stay `likely` or `speculative`.
- **Confirmation path declared** — Every finding names a concrete check that would confirm it without exploitation (a specific request and expected response, a configuration query, a behavioral probe). Vague paths like "manually verify" are a gap.
- **Cross-tool corroboration where applicable** — When multiple scanner categories could have caught the same class, the body explains either the corroborating signal or why only one tool reported it. A `likely` finding that survived only one scanner sweep is suspicious.
- **Environmental severity** — Severity reflects exploitability in this environment (auth gating, network reachability, prerequisites), not the published worst-case score on the CVE.
- **CVE / advisory references are real** — Any cited CVE, advisory ID, or vulnerability-database link MUST be a real one with a real source. Invented references are a hard reject.
- **Configuration weaknesses included** — The catalog isn't only CVE-class findings; visible misconfigurations (debug headers, exposed admin paths, weak TLS, info-disclosure responses) are in the catalog too.

## Common failure modes to look for

- A catalog where every entry is `confidence: confirmed` — almost always indicates a scanner dump that didn't get triage
- Findings that name a service version but list `confirmation path: unknown` — the version was banner-only and nobody decided how to confirm it
- A catalog with no configuration-class findings on a surface that obviously has them (e.g., a web service that returns `Server: <version>` and verbose error pages but has no info-leak finding)
- Severity ratings that match the published CVSS exactly with no environmental adjustment — usually a copy-paste from the source database
- CVE references that don't resolve, or "CVE-2099-XXXXX"-shaped placeholders
- The same speculative finding repeated across multiple units with no acknowledgement of the duplication
- Findings against out-of-scope assets (the catalog should have caught the scope mismatch upstream)

## What to do when filing

Prefer one FB per finding-class issue across the catalog (e.g., "speculative findings missing confirmation path", "severity ratings not environmentally adjusted") rather than one FB per individual entry — the fix loop's `enumerator` will rework the catalog more efficiently from clustered feedback. Cite the specific F-NN ids that exhibit the pattern.
