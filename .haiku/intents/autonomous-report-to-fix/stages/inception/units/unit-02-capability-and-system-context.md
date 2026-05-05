---
title: Capability needs and system context
model: sonnet
depends_on: []
outputs:
  - >-
    .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/capability-and-system-context.md
quality_gates:
  - name: artifact-exists
    command: >-
      test -s
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/capability-and-system-context.md
  - name: has-required-sections
    command: >-
      grep -q '^## Capability inventory'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/capability-and-system-context.md
      && grep -q '^## Adjacent systems'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/capability-and-system-context.md
      && grep -q '^## Trust boundaries'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/capability-and-system-context.md
  - name: capability-count
    command: >-
      [ "$(grep -cE '^### '
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/capability-and-system-context.md)"
      -ge 6 ]
status: pending
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
---
# Capability Needs and System Context

## Topic

Distill the capability inventory the report-to-fix loop requires — at the *what*, not *how*, level. Each capability gets a name, the rationale for needing it, the trust boundary it introduces, and a citation to the existing pattern in the codebase that demonstrates the capability is achievable in principle. Adjacent systems (Sentry, GitHub Actions, the existing auth-proxy, the website export pipeline) get named so downstream stages know what they're integrating with.

## Why this is its own unit

The discovery document lists capability needs in a flat bullet list. Downstream stages need a structured view that distinguishes load-bearing capabilities (the loop fails without them) from supporting ones, identifies where each crosses a trust boundary (user machine → Cloud Run, Cloud Run → GitHub, Cloud Run → Anthropic), and grounds each capability in a real precedent in the codebase. Without this, the design stage will re-discover the same context piecemeal.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/capability-and-system-context.md` MUST contain:

- A `## Capability inventory` section with at least six named capabilities (Cloud Run host, GitHub bot identity, GitHub OAuth for users, GitHub webhook receiver, Anthropic SDK invocation, durable per-fix state, client-side secret scrubber). Each subsection (`### <Capability>`) contains: one-paragraph rationale, the trust boundary it introduces, a citation to the existing precedent in the codebase
- A `## Adjacent systems` section naming Sentry (existing `haiku_report` backend), GitHub Actions (existing `.github/workflows/claude.yml`), auth-proxy (existing `deploy/auth-proxy/`), website static export pipeline (`website/next.config.ts`) — and the integration question each raises (replace? coexist? extend?)
- A `## Trust boundaries` section enumerating each boundary the loop crosses (user machine → Cloud Run; Cloud Run service ↔ Anthropic API; Cloud Run service ↔ GitHub; user browser → auth landing page) with the data class flowing across each
- An "Open Questions" section flagging any capability where the precedent doesn't fully establish feasibility (e.g., webhook ack < 10s under cold start)

The artifact MUST NOT specify port numbers, schemas, function signatures, environment variable names, or specific framework choices — those belong to the design stage. Capability names must be at the level of "needs durable state" not "needs Firestore document with TTL of 30 days."

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — Capability Needs (lines 71–78), Existing Code Structure (lines 110–129)
