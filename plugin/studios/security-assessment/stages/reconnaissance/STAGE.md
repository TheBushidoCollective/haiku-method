---
name: reconnaissance
description: Passive and active information gathering about the target
hats: [osint-analyst, network-mapper, verifier]
fix_hats: [classifier, osint-analyst, network-mapper, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
outputs:
  - discovery: target-profile
    hat: network-mapper
---

# Reconnaissance

The opening stage of the security assessment: turn the engagement's scope statement into a structured picture of the target's externally observable footprint. Reconnaissance answers "what's out there?" before any deeper probing or exploitation begins.

## Scope

Passive and active information gathering within authorized scope: public OSINT (DNS, certificate transparency, WHOIS, search, public repos, leaked-credential data) and active mapping (live hosts, exposed services, technology fingerprints, ingress points). Reconnaissance decides *what the target's surface looks like* — not what's wrong with each service (enumeration) or whether it can be exploited (exploitation).

## What to do

- Gather public information broadly and cite every finding to its source.
- Turn the OSINT pool into a concrete, observation-grounded target profile, not a list of guesses.
- Stay strictly within the engagement's authorized scope when probing actively.
- Distinguish observed facts from inferences so downstream stages know what's confirmed.

## What NOT to do

- Don't enumerate service-level vulnerabilities or pin CVEs — that's enumeration.
- Don't attempt any exploitation; reconnaissance only observes.
- Don't probe assets outside the authorized scope.
- Don't record a finding without the source that backs it.
