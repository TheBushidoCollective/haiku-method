---
title: >-
  inception-coverage review agent has no behavior for inception present but
  unclassifiable
status: closed
origin: adversarial-review
author: completeness (from product)
author_type: agent
created_at: '2026-04-28T23:53:33Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-09:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:53:33Z'
resolution: null
replies: []
---

## Finding

`plugin/studios/software/stages/design/review-agents/inception-coverage.md` Step 1 defines two cases:

1. Inception absent → short-circuit cleanly
2. Inception present → proceed to classify and audit

But there is a third case with no defined behavior: **inception is present but none of its content matches any of the four classification patterns** (no headings or sections containing "decision", "decided", "resolved", "open question", "ui surface", "ui impact", etc.). This can happen when:

- The inception agent produced a freeform narrative without standard section headings
- The DISCOVERY.md was authored by a human directly using non-standard section names
- The template was updated after inception ran and the existing artifact predates the standard heading conventions

## User-facing impact

In this scenario, the agent classifies zero decisions, zero UI surfaces, and zero open questions. It then proceeds to Step 4's failure-mode checks. With zero surfaces classified, every surface in the design output becomes a "scope creep" warning (since inception lists no surfaces, any design surface is "not listed"). The agent emits a flood of false-positive scope-creep warnings that block the review gate, even though inception was run and substantive content exists.

This is not a hypothetical edge case — it is likely in any real project where inception used `# What we're building` instead of `## UI Impact`, or `# Decisions made` instead of `## Decisions`.

## Missing scenario

The spec covers: inception absent → skip. It does not cover: inception present but zero classified content → emit a "could not classify inception artifacts" warning and list the files found, inviting human triage rather than emitting false-positive blockers.

## Required fix

Add a Step 1.5 (between discovery and classification) to `inception-coverage.md`:

> **If inception artifacts exist but Step 2 classification yields zero decisions, zero UI surfaces, and zero open questions:** Emit a single warning-severity note:
>
> "Inception artifacts found but could not be classified into standard categories (decisions / open-questions / ui-surfaces). Files: [list]. Human review recommended before proceeding. No blocking findings emitted."
>
> Return cleanly — do NOT proceed to Step 4's surface-gap checks, as they would produce false positives.

This closes the gap between "fully absent inception" and "fully classifiable inception" so the agent is safe across the full spectrum of real-world inception outputs.
