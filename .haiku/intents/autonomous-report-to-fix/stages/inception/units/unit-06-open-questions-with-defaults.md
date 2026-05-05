---
title: Open questions with proposed defaults
model: sonnet
depends_on:
  - unit-01-success-criteria-and-acceptance-shape
  - unit-04-privacy-and-data-handling-principles
outputs:
  - >-
    .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md
quality_gates:
  - name: artifact-exists
    command: >-
      test -s
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md
  - name: has-required-sections
    command: >-
      grep -q '^## Resolved-by-default'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md
      && grep -q '^## Needs human decision'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md
  - name: question-count
    command: >-
      [ "$(grep -cE '^### Q:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md)"
      -ge 7 ]
  - name: every-question-has-proposed-default-or-escalation
    command: >-
      [ "$(grep -cE '^### Q:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md)"
      = "$(grep -cE '^- \*\*Proposed default\*\*:|^- \*\*Needs human
      escalation\*\*:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md)"
      ]
status: pending
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - stages/inception/artifacts/success-criteria-and-acceptance-shape.md
  - stages/inception/artifacts/privacy-and-data-handling-principles.md
  - stages/inception/artifacts/capability-and-system-context.md
  - stages/inception/artifacts/affected-surfaces-and-user-flow.md
  - stages/inception/artifacts/risk-inventory.md
---
# Open Questions with Proposed Defaults

## Topic

Collect every open question from across the inception artifacts (success criteria, capability map, surfaces/flow, privacy principles, risks) and assign each one of two outcomes: a proposed default that downstream stages can adopt unless the user vetoes (veto-style approval), OR a `(needs human escalation)` flag with a reason explaining why the agent can't reasonably resolve it. This unit closes the loop on inception: every ambiguity gets named once, with a path forward, so downstream stages aren't quietly making these calls.

## Why this is its own unit

Distributing open questions across multiple artifacts means each downstream-stage agent has to find them, and they may be answered inconsistently across stages. One canonical artifact lets the product stage (which makes most product-level calls), the design stage (which picks technologies), and the security stage (which owns the threat model) each see the full set in one place. It also lets the user veto or override any single proposed default in one review pass.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md` MUST contain:

- A `## Resolved-by-default` section with at least five `### Q: <question>` entries, each with:
  - A 1–3 sentence statement of the question
  - `- **Proposed default**: <answer the agent thinks is correct>` (exactly this format)
  - `- **Rationale**: <why this default makes sense given the discovery context>`
  - `- **Source**: <which inception artifact this question came from>`
- A `## Needs human decision` section with at least two `### Q: <question>` entries, each with:
  - A 1–3 sentence statement of the question
  - `- **Needs human escalation**: <reason the agent can't reasonably resolve it>` (exactly this format)
  - `- **Decision deadline**: <which downstream stage hits this question>` (so the user knows when an answer is needed)
- The total question count across both sections MUST be ≥7 (the discovery doc has seven open questions; new ones may be added if other artifacts surfaced more, but none should be dropped silently)
- Cross-references: each entry cites the inception artifact (and section if applicable) where the question originated

The artifact MUST NOT close the questions itself (no `## Resolved` section). Resolution happens in the product stage when the user approves the proposed defaults or supplies different answers, OR in the design stage if the question requires a concrete approach to be picked first.

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — Open Questions (lines 81–88)
- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (from `unit-01`) — for any open questions surfaced there
- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md` (from `unit-04`) — for privacy-related open questions
- The full set of inception artifacts (researcher hat reads each via `haiku_unit_read` or directly from the artifacts directory) — to ensure nothing is dropped
