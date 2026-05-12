---
name: reconnaissance
description: Passive and active information gathering about the target
hats: [osint-analyst, network-mapper, verifier]
fix_hats: [classifier, osint-analyst, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
outputs:
  - discovery: target-profile
    hat: network-mapper
---

# Reconnaissance

Passive and active information gathering about the target. The opening stage of the assessment — turns the engagement's scope statement into a structured picture of the target's externally observable footprint. Units are **knowledge artifacts** (per ARCHITECTURE.md §2.2 research/distillation role): one unit per investigable surface (an asset class, a brand, a domain family, a known third-party integration).

## Per-unit baton

The three hats execute in `plan → do → verify` order:

- **`osint-analyst`** (plan): gathers public information about the unit's surface — DNS, certificate transparency, WHOIS, search engines, public code repos, public job postings, leaked-credential databases. Produces structured findings cited to sources.
- **`network-mapper`** (do): turns the OSINT pool into a concrete target profile — live hosts, exposed services, technology fingerprints, ingress points — using active probing within authorized scope.
- **`verifier`** (verify): validates the artifact's substance, citation, and internal consistency. Body-only per architecture §3.4.

The baton across the hats is the unit's accumulated body content: source findings → target profile → validated profile.

## Inputs and outputs

No upstream inputs — this is the first stage. Produces `TARGET-PROFILE.md` per unit (see `outputs/`), which feeds enumeration's input chain.

## Fix loop and gate

`fix_hats: [classifier, osint-analyst, feedback-assessor]` — the classifier routes the FB to the right unit, `osint-analyst` re-investigates, and the assessor independently decides closure. Gate is `auto` because findings at this stage are knowledge artifacts an internal reviewer (review-agent) is sufficient to validate; downstream stages catch substantive errors when they consume the outputs.
