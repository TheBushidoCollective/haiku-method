---
name: discovery
location: .haiku/intents/{intent-slug}/knowledge/DISCOVERY.md
scope: intent
format: text
required: true
---

# Discovery

Comprehensive understanding of the **problem space, business context, and high-level scope**. Inception captures **WHAT** we're solving and **WHY**, plus enough constraints for the design stage to plan. It does **NOT** specify **HOW**.

## Content Guide

The discovery document should cover:

### Business Context
- **Feature goal & vision** — what problem this solves, the desired outcome when it ships, and why now (urgency drivers, strategic alignment, dependencies)
- **Origin & context** — where the request came from: customer feedback with specific quotes or references, internal discussions, strategic initiatives, or upstream dependencies
- **Success criteria** — both functional (what users can do) and outcome-based (what business or user results we expect). Frame in user-observable terms, not implementation metrics.

### Competitive Landscape
- **Who offers something similar** — specific competitors with a brief description of their approach and links to relevant product pages
- **What they do well** — acknowledge strong implementations fairly
- **Gaps and opportunities** — where competitor solutions fall short and what can be done differently

### Considerations & Risks
- **Strategic considerations** — compliance scope, pricing implications, rollout strategy questions
- **Capability needs** — high-level dependencies the solution will require (e.g., "needs a relational database", "needs OAuth", "needs Slack integration"). Name the capability, not the specific technology choice.
- **Open questions** — things without answers yet, framed as questions for the team to resolve during design
- **Risks** — what could go wrong at the strategic or product level, what assumptions are being made

### UI Impact
- **Affected surfaces** — which screens, flows, or user-facing areas are new or modified, with a brief description per area. Name the surface ("user dashboard", "settings page"), not the components.

## Out of Scope for Inception

The following belong in **later stages** and **MUST NOT** appear in the discovery document:

- **Entity field names, types, or relationships** → design stage
- **API endpoints, methods, request/response shapes** → design stage
- **Architecture patterns, module boundaries, file paths** → design stage
- **Infrastructure resources, port numbers, deployment topology** → operations stage
- **Performance budgets, security policies, accessibility specs** → design stage (when they shape contracts) or operations stage (when they shape runtime config)
- **Specific shell commands, build scripts, or test runs** → development / validation stages
- **Code-archaeology summaries** ("this lives at `packages/foo/src/bar.ts`") — design pulls these as needed; inception should not pre-bind them

If the agent feels the urge to specify any of the above, that signals the wrong stage. Capture it as an **open question** or a **capability need** instead, and let the downstream stage answer it.

## Quality Signals

- A team member unfamiliar with the feature can understand the full picture from this document
- Business context is clear enough for non-technical stakeholders
- Competitive research includes specific competitors with links, not vague references
- Risks are framed at the product/strategic level ("we don't yet know how customers want to authenticate"), not at the implementation level ("the auth middleware has no test coverage")
- Success criteria are **observable by users**, not measured in implementation terms (✅ "user can publish in one click"; ❌ "publish endpoint p99 < 200ms")
- The document distinguishes the problem space from any specific solution
- Capability needs are named at the dependency level ("needs OAuth"), not the implementation level ("needs Auth0 with PKCE flow")
