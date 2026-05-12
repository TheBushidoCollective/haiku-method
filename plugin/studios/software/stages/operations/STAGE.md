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

Take working code from `development` and make it run reliably in production. This stage owns the runtime configuration, deployment pipeline, observability surface, and the on-call posture that turns a green test suite into a service users can depend on.

## Per-unit baton

Each operations unit walks `ops-engineer → sre → verifier`:

- **`ops-engineer`** (plan + do for the deployment surface) reads the architecture and behavioral spec, designs the deployment shape (image, manifest, env config, resource limits, health checks), and produces the runbook for the unit's operational responsibility
- **`sre`** (do for the reliability surface) wires observability (the four golden signals, structured logs, traces), defines SLOs / error budgets where applicable, and pairs each alert with a runbook
- **`verifier`** (verify) confirms the deployment is rollback-able, observability covers the failure modes, and the runbook is concrete enough for someone with no context

Detailed process lives in each hat's md file.

## Inputs and outputs

The frontmatter above declares the canonical I/O contract — upstream `inception/discovery`, `product/behavioral-spec`, and `development/{code, architecture}` feed in. This stage pulls in the development stage's `security` review agent (declared in `review-agents-include`) so security findings from build time aren't lost at deploy time. Outputs are deployment manifests, runbooks, dashboards, and alert definitions.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, ops-engineer, feedback-assessor]` dispatches per finding. The gate is `auto` — operational artifacts that pass the engine's spec-conformance gate plus the stage's `observability` + `reliability` review agents are good to advance, since the rollback path is the safety net for residual error. Project overlays at `.haiku/studios/software/stages/operations/` may add team-specific deployment platforms, named observability stacks, or paging conventions without modifying the plugin defaults.
