---
title: Affected surfaces and user flow
model: sonnet
depends_on: []
outputs:
  - >-
    .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md
quality_gates:
  - name: artifact-exists
    command: >-
      test -s
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md
  - name: has-required-sections
    command: >-
      grep -q '^## End-to-end user flow'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md
      && grep -q '^## Affected surfaces'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md
      && grep -q '^## State transitions'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md
  - name: surfaces-section-count
    command: >-
      [ "$(awk '/^## Affected surfaces/{found=1; next} found && /^## /{exit}
      found && /^### /{count++} END{print count+0}'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md)"
      -ge 4 ]
  - name: state-transitions-event-count
    command: >-
      [ "$(awk '/^## State transitions/{found=1; next} found && /^## /{exit}
      found && /^- /{count++} END{print count+0}'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md)"
      -ge 9 ]
status: pending
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - website/next.config.ts
  - 'website/app/auth/[provider]/callback/CallbackClient.tsx'
---
# Affected Surfaces and User Flow

## Topic

Map every UI surface the loop touches and the user-observable flow across them. Each surface gets a description of what changes, what it shows the user, and how it transitions to the next surface. The flow walks the user from the moment they type `/haiku:report` to the moment the PR merges, including the branch points where the user steps away (after OAuth, or after declining OAuth) and the loop continues without them.

## Why this is its own unit

The discovery document names four surfaces (skill, web page, GitHub issue, GitHub PR) but doesn't trace the flow between them. Downstream stages — especially `product` (which authors the PRD-style behavior specs) and `design` (which plans the SPA route under static export) — need a single map of who the user sees what, when, and how. State transitions between surfaces (and the surfaces involved when each system event fires) need to be enumerated so design and development don't independently invent flows.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/affected-surfaces-and-user-flow.md` MUST contain:

- A `## End-to-end user flow` section as a step-by-step narrative from `/haiku:report` invocation through final PR merge — naming the surface where each step is observed, the user action (or no action) required, and the system response
- An `## Affected surfaces` section with one `### <Surface>` subsection per surface (≥4 subsections — minimum: skill, `report/[id]` web page, GitHub issue, GitHub PR). Each subsection: what changes, what the user sees, what events the surface emits, what events it consumes
- A `## State transitions` section enumerating the events that transition the fix-id state machine (initial intake, OAuth granted, OAuth declined, issue opened, PR opened, review comment received, CI status received, fix iteration cap hit, PR merged) and which surface(s) reflect each
- A "Branch points" subsection describing where the user can decline OAuth, or close the tab, and what the system does next without them
- Citations to the discovery doc, `website/next.config.ts` (for the static-export constraint that shapes the web page), `website/app/auth/[provider]/callback/CallbackClient.tsx` (for the auth callback precedent)

The artifact MUST NOT specify route paths, query param names, response shapes, or implementation patterns. Surfaces are described at the user-flow level — "the user sees a confirmation that the report was received" not "the page renders <ReportConfirmation /> after a 200 from POST /api/report".

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — UI Impact (lines 98–108), Open Questions (lines 81–88)
- `website/next.config.ts` — production export constraint
- `website/app/auth/[provider]/callback/CallbackClient.tsx` — existing OAuth callback pattern
