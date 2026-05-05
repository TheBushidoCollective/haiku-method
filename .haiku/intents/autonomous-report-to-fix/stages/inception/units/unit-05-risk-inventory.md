---
title: Risk inventory with severity and detection signal
model: sonnet
depends_on:
  - unit-04-privacy-and-data-handling-principles
outputs:
  - >-
    .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md
quality_gates:
  - name: artifact-exists
    command: >-
      test -s
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md
  - name: has-required-sections
    command: >-
      grep -q '^## Risks'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md
  - name: risk-count
    command: >-
      [ "$(grep -cE '^### Risk:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md)"
      -ge 7 ]
  - name: every-risk-has-severity
    command: >-
      [ "$(grep -cE '^### Risk:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md)"
      = "$(grep -cE '^- \*\*Severity\*\*:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md)"
      ]
  - name: every-risk-has-detection-signal
    command: >-
      [ "$(grep -cE '^### Risk:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md)"
      = "$(grep -cE '^- \*\*Detection signal\*\*:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md)"
      ]
status: pending
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - stages/inception/artifacts/privacy-and-data-handling-principles.md
---
# Risk Inventory with Severity and Detection Signal

## Topic

Convert the discovery document's prose risk discussion into a structured risk register. Each risk gets: a stable name, a severity rating (low / med / high / critical), a one-paragraph description of the failure mode, the user-observable detection signal (how we'd know it's happening), and a one-sentence note on which downstream stage should own the mitigation. This becomes the canonical risk reference for the security stage's threat model and for product's go/no-go conversations.

## Why this is its own unit

A risk register that lives only in prose form (the discovery doc) can't be referenced item-by-item, can't be revisited when one specific risk gets reclassified, and can't be cross-referenced from later stages' specs. Splitting it into one unit produces a structured artifact that downstream stages can cite per-risk. The privacy/data-handling unit (`unit-04`) feeds this one because privacy risks (scrubbing failures, retention exposure) need their principles articulated first to be meaningfully classified.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md` MUST contain:

- A `## Risks` section with at least seven `### Risk: <Name>` entries. Each entry MUST contain:
  - `- **Severity**: <low | med | high | critical>` (exactly this format — gates check the count matches the entry count)
  - `- **Detection signal**: <how we'd know>` (exactly this format)
  - `- **Mitigation owner**: <stage name>` — names the downstream stage responsible for designing the mitigation (`design`, `development`, `operations`, `security`, or `product`)
  - A 2–4 sentence description paragraph after the bullets
- The seven risks MUST cover at minimum: scrubber false negatives, bot credential scope creep, unbounded fix-loop cost, cold-start webhook timeout, JSONL traversal incompleteness, large bundle exceeding request limits, OAuth attribution mismatch (issue not appearing in user's "created issues" list)
- An "Open Questions" section flagging risks where severity is debatable or where the detection signal is currently unknown

The artifact MUST NOT specify implementation mitigations (no specific limits, retry counts, or timeouts as binding decisions). Mitigation owners are named; the *how* belongs to the owning stage.

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — Risks section (lines 91–97), Strategic Considerations (lines 60–69)
- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md` (produced by `unit-04`) — for privacy risk classification
