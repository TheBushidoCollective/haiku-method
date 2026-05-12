---
name: enumeration
description: Service discovery, version detection, vulnerability scanning, and attack surface mapping
hats: [enumerator, vulnerability-scanner, verifier]
fix_hats: [classifier, enumerator, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: reconnaissance
    discovery: target-profile
outputs:
  - discovery: vulnerability-catalog
    hat: vulnerability-scanner
---

# Enumeration

Service discovery, version detection, vulnerability scanning, and attack surface mapping. Reconnaissance answered "what's there?"; enumeration answers "what's there in detail, and what could be wrong with it?" Units are **knowledge artifacts**: one unit per asset class or service category from the upstream target profile.

## Per-unit baton

The three hats execute in `plan → do → verify` order:

- **`enumerator`** (plan): deep-dives into the unit's services — protocols, versions, authentication mechanisms, exposed functionality, configuration tells. Produces a structured service inventory grounded in observed behavior.
- **`vulnerability-scanner`** (do): correlates the inventory against known vulnerability classes (OWASP Top 10 categories for web, CWE families for code-adjacent surfaces, version-pinned CVEs where applicable) and produces the vulnerability catalog entry for the unit.
- **`verifier`** (verify): validates the artifact's substance, citation, and false-positive triage. Body-only per architecture §3.4.

The baton: target profile slice → service inventory → triaged vulnerability catalog → validated catalog.

## Inputs and outputs

Consumes `reconnaissance/target-profile`. Produces `VULNERABILITY-CATALOG.md` per unit, which feeds exploitation's unit chain — each catalog entry becomes a candidate attack surface in the next stage.

## Fix loop and gate

`fix_hats: [classifier, enumerator, feedback-assessor]` dispatches per finding — typical findings are false positives, missed services, or unconfirmed version detections. Gate is `ask` because human triage of "what's worth attempting to exploit" is the most expensive cost in pentest engagements; the catalog needs human sign-off before the next stage spends time building PoCs.
