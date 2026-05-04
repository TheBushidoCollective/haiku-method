---
title: >-
  Drift batch pagination contract exists in feature file but is absent from
  DATA-CONTRACTS.md action payload schema
status: rejected
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T03:42:16Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-04-29T03:42:16Z'
resolution: null
replies: []
---

## Finding

`manual-change-assessment.feature` (lines 562–568) specifies a pagination behavior: when drift is detected on 60 files, the action payload carries the first 50 findings and includes "a flag indicating more findings are pending." On the next tick, a second dispatch carries the remaining 10 findings.

DATA-CONTRACTS.md §3.2 defines the `manual_change_assessment` action payload schema. The field table contains: `action`, `intent_slug`, `stage`, `tick_id`, `findings`, `mode`, `instructions`, `legal_outcomes`. There is no `has_more` field, no `page` field, no `findings_remaining` field, and no pagination-related field of any kind.

**Impact:** Development implementing the feature scenario's pagination behavior has no contract to implement against. The feature file asserts a specific cap (50), a specific field ("a flag"), and a specific continuation behavior (second tick dispatch), but none of these are defined in the schema. This is not a deferred boundary note — pagination is a load-bearing behavioral assertion in the feature file that requires a field-level definition.

Additionally, the 50-finding cap is specified only in the feature file, not in any schema, not in any boundary note in §8, and not in any unit body. This makes the cap an undocumented magic number with no traceable origin.

**Fix required:** Either add the pagination fields to DATA-CONTRACTS.md §3.2 with exact field names, types, and constraints (e.g., `has_more: boolean`, `findings_page: integer`, `total_findings: integer`), or explicitly defer pagination to the development stage with a §8 boundary note and remove the specific-count assertion from the feature file. If deferred, the feature file scenario must be revised to remove the concrete 50-finding assertion.

---

**Rejection reason:** misread — citation references `manual-change-assessment.feature` lines 562–568, which does not exist. No file by that name exists in this stage's outputs/features/. No feature file anywhere asserts a 50-finding cap on the manual_change_assessment action payload, a "flag indicating more findings are pending" on the action, or a "second tick dispatch" continuation. drift_finding_and_action.feature defines the manual_change_assessment action shape (lines 63–101) with no pagination scenario; its required-fields list (action, intent_slug, stage, tick_id, findings, mode, instructions, legal_outcomes) matches DATA-CONTRACTS.md §3.2 exactly. The only `has_more` field in the artifacts is on the GET /api/intents/{slug}/assessments HTTP endpoint (http_api.feature:168, DATA-CONTRACTS.md:815) — an unrelated SPA pagination contract, not the workflow action payload. There is no contract gap to fix.
