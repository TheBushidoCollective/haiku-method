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

Library security focuses on three surfaces: supply chain (transitive dependencies, known advisories, build reproducibility), public API attack surface (what a malicious or careless consumer can do with the library), and injection vectors relevant to the library's domain (path traversal for filesystem libraries, prototype pollution for utility libraries, server-side request forgery for HTTP clients, algorithmic complexity attacks for regex- or parsing-heavy libraries).

Unlike application security, library security must consider the library as a potential *source* of vulnerabilities in downstream applications — the threat model includes "what happens when my consumer misuses this." A library that is easy to use unsafely is insecure regardless of how clean its internal code is.

## Per-unit baton

Each unit walks three hats in `plan → adversarial-review → verify` order:

- **`threat-modeler`** (plan) names the attack surface, threat actors, plausible attack vectors, exploitability assessment, and proposed mitigations
- **`security-reviewer`** (adversarial-review) evaluates the unit against the threat model — confirms mitigations are real, consumer guidance lands in public docs, audit findings are addressed rather than acknowledged
- **`verifier`** (verify) walks the unit body's substance, threat-to-mitigation traceability, and decision-register consistency — the body-only structural check architecture §9 requires

Per architecture §3.5, the adversarial hats fire after plan-do; the verifier provides the body-only final check.

## Inputs and outputs

Inputs are inception's `discovery` (target consumers shape the consumer-misuse threat model) and `api-surface` (the attack surface is the public API itself), plus development's `code` (for the supply-chain audit). Output is the `security-report` family — per-surface threat models with verified mitigations and consumer guidance for whatever the release stage needs to surface.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, threat-modeler, feedback-assessor]` dispatches per finding. The gate is `[external, ask]` — the user may submit findings for external security review or approve locally. Project overlays at `.haiku/studios/libdev/stages/security/` may add house-style conventions (audit tool of choice, severity rubric, advisory format) without modifying the plugin defaults.
