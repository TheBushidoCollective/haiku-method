---
name: requirements
description: Functional, safety, and regulatory requirements
hats: [systems-engineer, compliance-officer, distiller, verifier]
fix_hats: [classifier, systems-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: inception
    discovery: discovery
---

# Requirements

Capture functional specifications (what the product does), safety
requirements (hazard analysis, failure modes, fail-safes), environmental
envelope (operating range, ingress protection, vibration), reliability
targets, and regulatory compliance obligations (FCC, CE, UL, FDA, IC,
RoHS, REACH and equivalent regional frameworks — name the categories
generically here; the specific frameworks for a project depend on its
product class and target markets, identified during inception).

Requirements constrain every downstream decision. Treat them as hard
gates, not suggestions. Regulatory frameworks especially cannot be
retrofitted — a product that wasn't designed for the right emissions
class will fail cert, and fixing it means redesigning the PCB and re-doing
the cert sweep.

## Per-unit baton

Each requirements unit walks the four hats in order:

- **`systems-engineer`** (plan) translates upstream discovery into testable
  functional / non-functional requirements with unique IDs and verification
  approaches.
- **`compliance-officer`** (plan / do) identifies every regulatory framework
  applicable to the product class + target markets and documents the
  applicability evidence + cost / lead-time impact.
- **`distiller`** (do) structures the unit's slice of requirements into the
  agreed shape (functional / safety / regulatory / environmental / reliability)
  with traceability back to discovery and forward to validation.
- **`verifier`** (verify) checks substance, testability, completeness against
  the unit's requirement category, and decision-register consistency — body
  only.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, systems-engineer,
feedback-assessor]` dispatches per finding. The systems-engineer hat is the
implementer because most requirement findings are about traceability,
testability, or contradictions that need the originating role to fix. The
gate is `[external, ask]` — regulatory and safety frameworks often need
formal signoff from a compliance lead outside the agent loop.
