---
title: Privacy and data handling principles
model: sonnet
depends_on: []
outputs:
  - stages/inception/artifacts/privacy-and-data-handling-principles.md
quality_gates:
  - name: artifact-exists
    command: >-
      test -s
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md
  - name: has-required-sections
    command: >-
      grep -q '^## Privacy policy delta'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md
      && grep -q '^## Consent UX principles'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md
      && grep -q '^## Scrubbing principles'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md
      && grep -q '^## Retention and disclosure'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md
  - name: scrubbing-data-class-coverage
    command: >-
      [ "$(awk '/^## Scrubbing principles/{found=1; next} found && /^## /{exit}
      found && /^- \*\*/{count++} END{print count+0}'
      .haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md)"
      -ge 5 ]
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - website/content/pages/privacy.md
  - packages/haiku/src/telemetry.ts
started_at: '2026-05-05T22:29:42Z'
iterations:
  - hat: researcher
    started_at: '2026-05-05T22:29:42Z'
    completed_at: '2026-05-05T22:32:44Z'
    result: advance
  - hat: distiller
    started_at: '2026-05-05T22:32:44Z'
    completed_at: '2026-05-05T22:35:18Z'
    result: advance
  - hat: verifier
    started_at: '2026-05-05T22:35:18Z'
    completed_at: '2026-05-05T22:36:21Z'
    result: advance
discovery: {}
reviews: {}
approvals:
  user:
    at: '2026-05-05T22:36:21Z'
    migrated: true
---
# Privacy and Data Handling Principles

## Topic

Articulate the privacy contract the report-to-fix loop establishes with users, the principles the scrubber must satisfy to honor that contract, and the policy surfaces that must change before the loop ships. The current `website/content/pages/privacy.md` explicitly states "None of that data is sent to GigSmart servers" — this becomes false the moment the loop ships, so the policy surface is load-bearing for the launch and must be sharpened in inception so product and design can reason about it.

## Why this is its own unit

This is the most consequential single topic in the discovery document. The privacy policy gap (line 60–62 of DISCOVERY.md) is a launch blocker, not a footnote. The consent UX, scrubbing principles, and retention policy each cascade into product and design decisions (where the consent prompt lives, how the user sees what was sent, how long Cloud Run keeps the bundle). Treating it as one unit ensures these three pieces stay coherent — a scrubbing principle without a consent UX is a half-policy.

## Completion criteria

The artifact at `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/privacy-and-data-handling-principles.md` MUST contain:

- A `## Privacy policy delta` section that names the exact existing policy claim being changed (with citation to `website/content/pages/privacy.md` and the line/section), the replacement language at the principle level (not the final copy), and the gating relationship between the policy update and feature ship
- A `## Consent UX principles` section that articulates whether consent is collected before or after data leaves the user's machine, what the user sees about what's being sent, and the behavioral default if the user closes the tab partway. Names the tradeoff axis (friction vs informed consent)
- A `## Scrubbing principles` section enumerating the data classes the scrubber MUST strip (≥5 classes — at minimum: API tokens / bearer credentials, environment variable values, `/Users/<name>/...` and `/home/<name>/...` absolute paths, IP addresses, email addresses appearing in tool output). Each class gets a `- **<Class>**:` rationale + detection signal description (regex family, contextual rule, etc., at the principle level — not the regex itself)
- A "Conservative-on-uncertainty" subsection — articulate why the scrubber strips on ambiguous matches rather than passing them through, citing the trust-risk dimension from DISCOVERY.md
- A `## Retention and disclosure` section: how long the Cloud Run service retains the bundle, who can access it, what the user is told they can request (deletion, copy)
- An "Open Questions" section with proposed defaults for: pre-send preview UX, retention duration, deletion-request mechanism

The artifact MUST NOT specify regex patterns, function signatures, storage backends, or specific retention numbers as binding decisions — the *principles* set the constraints; the design stage picks the concrete numbers and patterns to satisfy them.

## Inputs

- `.haiku/intents/autonomous-report-to-fix/knowledge/DISCOVERY.md` — Strategic Considerations (lines 60–69), Risks (lines 91–97), Open Questions (lines 81–88)
- `website/content/pages/privacy.md` — current policy text (the load-bearing claim)
- `packages/haiku/src/telemetry.ts` — existing scrubbing precedent (`sanitizeAttributes` and `PII_DENY_KEYS`) for principle reference
