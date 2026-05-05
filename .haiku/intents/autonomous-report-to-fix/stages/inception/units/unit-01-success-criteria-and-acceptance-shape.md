---
title: Success criteria and acceptance shape
model: sonnet
depends_on: []
outputs:
  - >-
    .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
quality_gates:
  - name: artifact-exists
    command: >-
      test -s
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
  - name: has-required-sections
    command: >-
      grep -q '^## Fire-and-forget UX contract'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      && grep -q '^## Acceptance shape — what "done" looks like'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
      && grep -q '^## Bounded loops — caps and escape hatches'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md
  - name: criteria-are-observable
    command: >-
      [ "$(grep -cE '^- '
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md)"
      -ge 6 ]
status: completed
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - plugin/skills/report/SKILL.md
completed_at: '2026-05-05T22:37:09Z'
---
# Success Criteria and Acceptance Shape

## Topic

Sharpen the success criteria for the autonomous report-to-fix loop into user-observable, measurable outcomes. Articulate the fire-and-forget UX contract precisely — what the user does, what the system does, and where the line falls between "the user's job is done" and "the system takes over." Define explicit caps and escape hatches so that "autonomous until green" doesn't become "autonomous until budget exhaustion."

## Why this is its own unit

The discovery document captures the *shape* of success ("issue + PR opened, fix lands, CI green") but not the precise observable boundaries. Downstream stages (`product`, `design`) need a sharpened version they can test against — including the failure modes (fix loop gives up, scrubbing missed something, OAuth declined) and how each is communicated back to the user without breaking the fire-and-forget contract.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md` MUST contain:

- A `## Fire-and-forget UX contract` section that names the exact user actions in order (run skill, describe problem, optionally OAuth on landing page, close tab) and the system response after each — observable in the UI, not in internal state
- A `## Acceptance shape — what "done" looks like` section listing the user-observable end states (issue created, PR opened, PR merged + CI green) with the surface where each is observed
- A `## Bounded loops — caps and escape hatches` section that names: maximum bot iterations per fix-id before escalation, behavior on irrecoverable fix failure (PR stays open as draft? closed? bot comments and stops?), behavior on user OAuth decline (issue still gets opened under bot identity)
- A "Open Questions" section with proposed defaults (or `(needs human escalation)` flags) for any ambiguous criterion
- Citations: each acceptance claim references the discovery doc section, the existing `/haiku:report` skill behavior at `plugin/skills/report/SKILL.md`, or a specific design conversation point

The artifact MUST NOT prescribe API endpoints, request/response shapes, or implementation paths — those belong to the design stage.

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — Success Criteria section (lines 27–32), Open Questions section (lines 81–88)
- `plugin/skills/report/SKILL.md` — current `/haiku:report` behavior for delta articulation
