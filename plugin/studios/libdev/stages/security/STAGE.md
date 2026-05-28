---
name: security
description: Supply chain, dependency audit, and consumer-misuse threat model
hats: [threat-modeler, security-reviewer, verifier]
fix_hats: [classifier, threat-modeler, feedback-assessor]
review: [external, ask]
elaboration: autonomous
inputs:
  - stage: inception
    discovery: discovery
  - stage: inception
    discovery: api-surface
  - stage: development
    output: code
---

# Security

Audit the library across the surfaces that make a dependency dangerous: the supply chain, the public API attack surface, and the injection vectors specific to the library's domain. Library security is distinct from application security — the library is a potential *source* of vulnerabilities in every downstream application, so the threat model includes what happens when a consumer misuses it.

## Scope

Threat modeling and adversarial review of the library as a dependency — transitive advisories and build reproducibility, what a careless or malicious consumer can do with the public API, and domain-specific injection vectors (path traversal, prototype pollution, SSRF, algorithmic-complexity attacks). Security decides *where the library can be made unsafe and how to mitigate it* — not the API shape (inception) or the implementation (development), though it reads both.

## What to do

- Model each attack surface: actors, vectors, exploitability, and the mitigation that closes it.
- Treat consumer misuse as in-scope — a library that's easy to use unsafely is insecure regardless of internal code quality.
- Audit the supply chain: transitive dependencies, known advisories, build reproducibility.
- Confirm mitigations are real and land the consumer-safety guidance the release stage needs to surface.

## What NOT to do

- Don't reshape the API or rewrite the implementation here — file findings; inception and development own those changes.
- Don't limit the threat model to the library's own code; the consumer's misuse path is the point.
- Don't claim a mitigation without confirming it actually holds against the vector it targets.
- Don't leave a known supply-chain advisory unassessed.
