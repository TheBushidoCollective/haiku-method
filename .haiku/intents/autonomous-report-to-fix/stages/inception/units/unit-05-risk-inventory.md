---
title: Risk inventory with severity and detection signal
model: sonnet
depends_on:
  - unit-01-success-criteria-and-acceptance-shape
  - unit-04-privacy-and-data-handling-principles
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - stages/inception/artifacts/success-criteria-and-acceptance-shape.md
  - stages/inception/artifacts/privacy-and-data-handling-principles.md
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
      -ge 8 ]
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
  - name: every-risk-has-mitigation-owner
    command: >-
      [ "$(grep -cE '^### Risk:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md)"
      = "$(grep -cE '^- \*\*Mitigation owner\*\*:'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md)"
      ]
status: active
bolt: 1
hat: researcher
started_at: '2026-05-05T22:43:26Z'
hat_started_at: '2026-05-05T22:43:26Z'
iterations:
  - hat: researcher
    started_at: '2026-05-05T22:43:26Z'
    completed_at: null
    result: null
---
# Risk Inventory with Severity and Detection Signal

## Topic

Convert the discovery document's prose risk discussion into a structured risk register. Each risk gets: a stable name, a severity rating (low / med / high / critical), a one-paragraph description of the failure mode, the user-observable detection signal (how we'd know it's happening), and a one-sentence note on which downstream stage should own the mitigation. This becomes the canonical risk reference for the security stage's threat model and for product's go/no-go conversations.

## Why this is its own unit

A risk register that lives only in prose form (the discovery doc) can't be referenced item-by-item, can't be revisited when one specific risk gets reclassified, and can't be cross-referenced from later stages' specs. Splitting it into one unit produces a structured artifact that downstream stages can cite per-risk. The privacy/data-handling unit (`unit-04`) feeds this one because privacy risks (scrubbing failures, retention exposure) need their principles articulated first to be meaningfully classified. The success-criteria unit (`unit-01`) feeds this one because cost-control and bounded-loop risks are framed against the cap-existence assertion unit-01 makes.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md` MUST contain:

- A `## Risks` section with at least eight `### Risk: <Name>` entries. Each entry MUST contain (each on its own line, in this exact order):
  - `- **Severity**: <low | med | high | critical>` (exactly this format — gates check the count matches the entry count)
  - `- **Detection signal**: <how we'd know>` (exactly this format)
  - `- **Mitigation owner**: <stage name>` (exactly this format) — names the downstream stage responsible for designing the mitigation (`design`, `development`, `operations`, `security`, or `product`)
  - A 2–4 sentence description paragraph after the bullets
- The eight risks MUST cover at minimum:
  1. Scrubber false negatives (a credential leaks through to Cloud Run)
  2. Bot credential scope creep (the bot token is over-scoped or leaks)
  3. Unbounded fix-loop cost (cost ceiling absent or hit by a single fix-id)
  4. Cold-start webhook timeout (Cloud Run cold start vs GitHub's 10s ack window)
  5. JSONL traversal incompleteness (`parent_uuid` chain miss → diagnostic context partial)
  6. Large bundle exceeding request limits (multi-MB JSONL bundles)
  7. OAuth attribution mismatch (issue not appearing in user's "created issues" list)
  8. **Anthropic API single-vendor dependency** — the fix loop has no fallback when the Anthropic API is unavailable, rate-limited, deprecated, or repriced. Every fresh invocation requires a live API call; there is no degraded mode. Severity: high. Mitigation owner: operations.
- An "Open Questions" section flagging risks where severity is debatable or where the detection signal is currently unknown.

The artifact MUST NOT specify implementation mitigations (no specific limits, retry counts, or timeouts as binding decisions). Mitigation owners are named; the *how* belongs to the owning stage.

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — Risks section (lines 91–97), Strategic Considerations (lines 60–69)
- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md` (produced by `unit-01`) — for cap/cost-bound framing
- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md` (produced by `unit-04`) — for privacy risk classification
