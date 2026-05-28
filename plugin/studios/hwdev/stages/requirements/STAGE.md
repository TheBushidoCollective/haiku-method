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

Capture what the hardware product must do and the frameworks it must satisfy: functional specifications, safety requirements, environmental envelope, reliability targets, and regulatory compliance obligations. These constrain every downstream decision and behave as hard gates — regulatory frameworks especially cannot be retrofitted without redesigning the board and redoing the cert sweep.

## Scope

Requirement capture and framework identification: testable functional and non-functional requirements, hazard analysis and fail-safes, the operating envelope, reliability targets, and the applicable regulatory regimes for the product class. Requirements decides *what the product must satisfy* — not how it's built to satisfy it (design, firmware) or whether it actually does (validation).

## What to do

- Write each requirement to be testable, with a unique ID and a stated verification approach.
- Identify every regulatory framework applicable to the product class and target markets, with applicability evidence and cost/lead-time impact.
- Keep traceability — back to inception's findings and forward to validation's tests.
- Treat safety and regulatory requirements as hard gates, naming hazards, failure modes, and fail-safes explicitly.

## What NOT to do

- Don't design the product against the requirements — schematic, layout, and enclosure are the design stage.
- Don't reopen the market or product-class decision inception already made.
- Don't write an aspirational requirement that has no verification approach.
- Don't defer a regulatory framework to "figure out later"; a missed emissions class fails cert and forces a redesign.
