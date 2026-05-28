---
name: enumeration
description: Service discovery, version detection, vulnerability scanning, and attack surface mapping
hats: [enumerator, vulnerability-scanner, verifier]
fix_hats: [classifier, enumerator, vulnerability-scanner, feedback-assessor]
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

Service discovery, version detection, vulnerability scanning, and attack-surface mapping. Reconnaissance answered "what's there?"; enumeration answers "what's there in detail, and what could be wrong with it?" — producing the vulnerability catalog that exploitation draws its candidate surfaces from.

## Scope

Detailed service interrogation and vulnerability correlation: protocols, versions, auth mechanisms, exposed functionality, and the known-vulnerability classes (OWASP categories, CWE families, version-pinned CVEs) that map onto them. Enumeration decides *what's potentially wrong with each service* — not what the surface is (reconnaissance) or whether a vulnerability is actually exploitable (exploitation).

## What to do

- Deep-dive each service to a structured inventory grounded in observed behavior, not assumed configuration.
- Correlate the inventory against known vulnerability classes and pin findings to the right CWE/CVE where applicable.
- Triage false positives before they enter the catalog — an unconfirmed finding wastes the most expensive cycles downstream.
- Cite the evidence behind each catalog entry so a human can decide what's worth attempting.

## What NOT to do

- Don't attempt exploitation or build proof-of-concept code — that's exploitation.
- Don't re-run reconnaissance; missing surfaces are feedback upstream, not a fresh recon pass here.
- Don't ship a vulnerability catalog full of untriaged or unconfirmed findings.
- Don't claim a version or vulnerability you couldn't observe.
