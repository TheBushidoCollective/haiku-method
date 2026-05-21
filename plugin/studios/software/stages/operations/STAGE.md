---
name: operations
description: Deployment, monitoring, and operational readiness
hats: [ops-engineer, sre, verifier]
fix_hats: [classifier, ops-engineer, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: inception
    discovery: discovery
  - stage: product
    discovery: behavioral-spec
  - stage: development
    output: code
  - stage: development
    discovery: architecture
review-agents-include:
  - stage: development
    agents: [security]
---

# Operations

Take working code from development and make it run reliably in production: the runtime configuration, deployment path, observability, and on-call posture that turn a green test suite into a service people can depend on.

## Scope

Operational readiness — deployment shape, configuration, monitoring, alerting, and runbooks. Not feature work or behavior changes; the system's job was settled upstream, this stage makes it survivable.

## What to do

- Make every deployment rollback-able before it ships.
- Cover the real failure modes with observability, and pair every alert with a runbook that says what to do.
- Write runbooks concrete enough for someone with no prior context to follow under pressure.

## What NOT to do

- Don't add features or change behavior — that's a new intent, not an operations task.
- Don't ship a deployment with no rollback path.
- Don't define alerts no one can act on, and don't assume production behaves like your local machine.
