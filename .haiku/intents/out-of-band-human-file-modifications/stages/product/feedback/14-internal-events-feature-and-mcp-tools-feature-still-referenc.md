---
title: >-
  internal_events.feature and mcp_tools.feature still reference
  feedback-addressed clearance trigger
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-04-29T04:01:22Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-14:bolt-2'
bolt: 2
triaged_at: '2026-04-29T04:01:22Z'
resolution: null
replies: []
---

## Finding

After FB-02 (bolt 3) tightened the `haiku_baseline_clear_marker` trigger enum in DATA-CONTRACTS.md §4.4 + §6.3 and the two flagged feature files (`pending_marker_schema.feature`, `manual-change-assessment.feature`) to the conservative terminal-only contract (`closed` | `rejected` | `revisit-complete`), two product-stage feature files still reference the obsolete `feedback-addressed` trigger:

- `stages/product/outputs/features/internal_events.feature`
  - line 120: `Scenario: pending_marker_cleared is emitted when haiku_baseline_clear_marker clears a marker`
  - line 122: `When haiku_baseline_clear_marker fires with trigger "feedback-addressed"`
  - lines 148–150: Examples table still lists `feedback transitioned to addressed | feedback-addressed`
  - line 169: emits `pending_marker_cleared` with `trigger = feedback-addressed`

- `stages/product/outputs/features/mcp_tools.feature`
  - line 221: `When haiku_baseline_clear_marker fires with trigger "feedback-closed"` (this one is fine, but the surrounding scenarios are not)
  - lines 266–270: `Scenario: Clearing marker with feedback-addressed trigger updates cleared_at and baseline`
  - lines 281–286: `Scenario: Clearing when feedback-addressed fires before feedback-closed (R5 contract)` — directly contradicts the now-current R5
  - lines 303–307: Scenario Outline includes `feedback-addressed` as a valid trigger value

## Required fix

Tighten both feature files to the conservative terminal-only contract:
- Remove `feedback-addressed` from all trigger enums and Examples tables
- Replace the "addressed fires" scenarios with explicit "addressed does NOT clear" scenarios that match the rationale in `pending_marker_schema.feature` and `manual-change-assessment.feature`
- Update R5-referencing scenarios to assert the corrected contract: marker clears only on `closed` | `rejected` | `revisit-complete`

## Why surfaced separately

These files were not explicitly cited in FB-02's body (which named DATA-CONTRACTS.md §4.4, `pending_marker_schema.feature`, `manual-change-assessment.feature`, unit-01 AC). Editing them in the FB-02 fix chain would have been a scope violation. Logging as a follow-up so it goes through the proper triage + fix-loop dispatch.

## Cross-references

- DATA-CONTRACTS.md §4.4 R5 (terminal-only contract)
- DATA-CONTRACTS.md §6.3 `pending_marker_cleared` payload
- `pending_marker_schema.feature` (closed-clears / rejected-clears / addressed-does-NOT-clear)
- `manual-change-assessment.feature` (Scenario Outline over closed | rejected, addressed-NOT scenario)
- `unit-01-acceptance-criteria.md` AC-G5 / AC-SF3
