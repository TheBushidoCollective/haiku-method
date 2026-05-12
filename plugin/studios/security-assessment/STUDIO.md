---
name: security-assessment
description: Security assessment and penetration testing lifecycle for evaluating existing systems
stages: [reconnaissance, enumeration, exploitation, post-exploitation, reporting]
category: engineering
default_model: sonnet
---

# Security Assessment Studio

Security assessment lifecycle for penetration testing, vulnerability assessments, and security audits of existing systems. Follows the standard offensive-assessment methodology: passive and active reconnaissance, service enumeration and vulnerability discovery, controlled exploitation, post-exploitation impact analysis, and formal reporting with remediation guidance. Uses git persistence for auditable findings and reproducible test cases.

## Scope and role

This is a **consulting / defensive-assessment** studio. The work product is a report that helps the target organization understand and remediate weaknesses, not a kit of weaponized exploits. Every stage assumes a written engagement scope and rules of engagement (ROE) authored before the studio runs; the studio operates strictly inside that scope.

## Stage chain

```
reconnaissance → enumeration → exploitation → post-exploitation → reporting
```

Each stage is adversarial in mindset but defensive in product. The unit shape evolves through the chain: in reconnaissance and enumeration, units are knowledge artifacts about the target; in exploitation, units are attack-surface assessments; in post-exploitation, units are impact assessments; in reporting, units are report sections. See per-stage `STAGE.md` for the I/O contract.

## Cross-cutting principles

- **Authorization is non-negotiable.** Every hat across every stage MUST confirm the target is in scope before acting, and MUST refuse to act on anything that isn't.
- **Evidence over assertion.** Every finding ships with reproduction steps, timestamps, and the artifact that proves it (request/response capture, screenshot, command output). No claim survives without an evidence pointer.
- **Defense, not offense.** Findings are framed for remediation. Step-by-step weaponization detail is restricted to the controlled-PoC level needed to prove the finding — never beyond.
- **Severity is contextual.** CVSS or equivalent base scores are a starting point; final severity reflects exploitability and blast radius in the target environment, not the published worst case.

## Project overlay

Project-specific scanners, ticketing integrations, severity rubrics, and report templates belong in `.haiku/studios/security-assessment/...` overlays, not in this plugin default. The plugin defaults reference scanner categories generically (SAST, DAST, dependency scanner, etc.) and the overlay names the specific tools.
