---
name: security
description: Threat modeling, security review, and vulnerability assessment
optional: true
hats: [threat-modeler, security-engineer, security-reviewer]
fix_hats: [classifier, security-engineer, feedback-assessor]
review: [external, ask]
elaboration: autonomous
inputs:
  - stage: inception
    discovery: discovery
  - stage: product
    discovery: behavioral-spec
  - stage: product
    discovery: data-contracts
  - stage: development
    output: code
  - stage: development
    discovery: architecture
review-agents-include:
  - stage: development
    agents: [security, architecture]
  - stage: operations
    agents: [reliability]
gate-protocol:
  timeout: 72h
  timeout-action: escalate
  escalation: comms
  conditions:
    - "no HIGH findings from review agents"
---

# Security

Adversarially evaluate whether the built system withstands realistic threats. This is the project's defensive backstop — it catches the class of bugs that pass functional review (the feature works as specified) but fail under abuse (the feature is used in ways the spec never modeled).

## Scope

Adversarial security evaluation of what was built: threat modeling, mitigations, and active attempts to defeat them. Units here are **attack surfaces**, not features. Not functional review, not new feature work.

## What to do

- Model the attack surfaces and trust boundaries, and enumerate threats against each.
- Pair every identified threat with a specific, concrete mitigation — not a note that it exists.
- Actually try to defeat the model: abuse-of-feature paths, side channels, supply-chain angles.
- Route findings back to the stage that owns the fix (development, operations) as feedback.

## What NOT to do

- Don't re-grade whether the feature works as specified — functional review already covered that.
- Don't accept a threat with no mitigation, or wave through "the scanner found nothing" as proof of safety.
- Don't add features or change behavior.
