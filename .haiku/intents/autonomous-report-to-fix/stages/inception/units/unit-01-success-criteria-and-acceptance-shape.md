---
title: Success criteria and acceptance shape
model: sonnet
depends_on: []
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - plugin/skills/report/SKILL.md
outputs:
  - >-
    .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
  - stages/inception/artifacts/success-criteria-and-acceptance-shape.md
quality_gates:
  - name: artifact-exists
    command: >-
      test -s
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
  - name: has-required-sections
    command: >-
      grep -q '^## Fire-and-forget UX contract'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      && grep -q '^## Acceptance shape'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      && grep -q '^## Bounded loops'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      && grep -q '^## Competitive differentiation'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
  - name: bounded-loops-mentions-cap-as-open-question
    command: >-
      awk '/^## Bounded loops/{found=1} found && /^## [^B]/{exit} found'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      | grep -qiE '(open question|product stage|design stage|to be
      decided|defer)'
  - name: bounded-loops-has-failure-mode-behavior
    command: >-
      awk '/^## Bounded loops/{found=1} found && /^## [^B]/{exit} found'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      | grep -qiE '(draft|closed|bot comment|gives up|escalat|stop)'
  - name: bounded-loops-has-oauth-decline-behavior
    command: >-
      awk '/^## Bounded loops/{found=1} found && /^## [^B]/{exit} found'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      | grep -qiE 'oauth.*(declin|without|bot account|bot identity)'
  - name: competitive-differentiation-names-competitors
    command: >-
      awk '/^## Competitive differentiation/{found=1} found && /^## [^C]/{exit}
      found'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      | grep -ciE '(copilot|devin|sweep|cursor|openhands)' | awk '{exit
      ($1>=4)?0:1}'
status: active
bolt: 1
hat: distiller
started_at: '2026-05-05T22:29:27Z'
hat_started_at: '2026-05-05T22:33:15Z'
iterations:
  - hat: researcher
    started_at: '2026-05-05T22:29:27Z'
    completed_at: '2026-05-05T22:33:15Z'
    result: advance
  - hat: distiller
    started_at: '2026-05-05T22:33:15Z'
    completed_at: null
    result: null
---
# Success Criteria and Acceptance Shape

## Topic

Sharpen the success criteria for the autonomous report-to-fix loop into user-observable, measurable outcomes. Articulate the fire-and-forget UX contract precisely — what the user does, what the system does, and where the line falls between "the user's job is done" and "the system takes over." Frame the loop's strategic differentiation against competitor offerings so downstream stages preserve the differentiator. Acknowledge that bounded loops (per-fix-id iteration cap, escape hatches) are required without picking the cap value here — that's product/design stage work.

## Why this is its own unit

The discovery document captures the *shape* of success ("issue + PR opened, fix lands, CI green") but not the precise observable boundaries. Downstream stages (`product`, `design`) need a sharpened version they can test against — including the failure modes (fix loop gives up, scrubbing missed something, OAuth declined) and how each is communicated back to the user without breaking the fire-and-forget contract. The competitive differentiation lives in the same artifact because it's the same lens: what makes "done" different from what Copilot Workspace, Devin, Sweep, Cursor, and OpenHands deliver today.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md` MUST contain:

- A `## Fire-and-forget UX contract` section that names the exact user actions in order (run skill, describe problem, optionally OAuth on landing page, close tab) and the system response after each — observable in the UI, not in internal state.
- A `## Acceptance shape — what "done" looks like` section listing the user-observable end states (issue created, PR opened, PR merged + CI green) with the surface where each is observed.
- A `## Bounded loops — caps and escape hatches` section that:
  - (a) acknowledges that a per-fix-id iteration limit must exist and explains why (cost control, user trust, vendor-cost discipline);
  - (b) describes the user-observable behavior when the limit is reached (bot stops, PR state — draft / closed / left-as-is, user notification surface);
  - (c) describes the user-observable behavior when the user declines the OAuth grant (issue still gets opened under bot identity, attribution falls back to whatever name/email the skill collected);
  - (d) identifies the actual cap value as an Open Question for product/design — does NOT pick a number here. Inception names *that* a cap exists and *what* hitting it looks like; product/design picks the *number* and chooses the visible state of the PR.
- A `## Competitive differentiation` section naming at least four competitors (from: GitHub Copilot Workspace, Devin, Sweep, Cursor, OpenHands) with one paragraph per competitor describing what each does and does NOT do with respect to: session bundle as diagnostic artifact, fire-and-forget UX, autonomous-until-green fix loop. End with a one-paragraph differentiation claim that downstream product/design must preserve.
- An "Open Questions" section with proposed defaults (or `(needs human escalation)` flags) for any ambiguous criterion.
- Citations: each acceptance claim references the discovery doc section, the existing `/haiku:report` skill behavior at `plugin/skills/report/SKILL.md`, or a specific design conversation point. Each competitor entry references the discovery doc's competitive landscape section (and the URL therein).

The artifact MUST NOT prescribe API endpoints, request/response shapes, or implementation paths — those belong to the design stage. The artifact MUST NOT pick a concrete iteration cap number, a concrete retention duration, or any other operational parameter.

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — Success Criteria section (lines 27–32), Open Questions (lines 81–88), Competitive Landscape (lines 34–56)
- `plugin/skills/report/SKILL.md` — current `/haiku:report` behavior for delta articulation
