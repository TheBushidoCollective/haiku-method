---
name: security
description: Threat modeling, security review, and vulnerability assessment
hats: [threat-modeler, security-engineer, security-reviewer, red-team, blue-team]
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

Take the built system and adversarially evaluate whether it withstands realistic threats. This stage is the project's defensive backstop — it catches the class of bugs that pass functional review (the feature works as specified) but fail under abuse (the feature is used in ways the spec didn't model).

## Per-unit baton

Units in this stage are **attack surfaces**, not features. Each unit walks `threat-modeler → security-engineer → security-reviewer → red-team → blue-team` per architecture §3.5 (plan → do → verify + adversarial loop):

- **`threat-modeler`** (plan) enumerates entry points, applies STRIDE (or equivalent) per entry point, identifies trust boundaries, and proposes mitigations
- **`security-engineer`** (do) implements / specifies the mitigations and produces the threat-model artifact
- **`security-reviewer`** (verify) confirms every identified threat has a specific mitigation and the model is comprehensive
- **`red-team`** (adversarial-do) attempts to defeat the model — exploitation feasibility, abuse-of-feature paths, side channels, supply-chain angles
- **`blue-team`** (adversarial-verify) closes the loop on red-team findings, either confirming each is mitigated or escalating

Detailed process lives in each hat's md file.

## Inputs and outputs

The frontmatter above declares the canonical I/O contract. This stage pulls in `development/{security, architecture}` and `operations/reliability` review agents so build-time and deploy-time security concerns flow into the final adversarial pass. Outputs are the threat model, mitigations record, and any findings that route back to development or operations as feedback.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, security-engineer, feedback-assessor]` dispatches per finding. The gate is `[external, ask]` with a `gate-protocol` timeout that escalates after 72h if no HIGH findings remain — the protocol exists so security review can't silently block delivery indefinitely. Project overlays at `.haiku/studios/software/stages/security/` may add team-specific threat libraries, named scanners, or compliance-driven check additions without modifying the plugin defaults.
