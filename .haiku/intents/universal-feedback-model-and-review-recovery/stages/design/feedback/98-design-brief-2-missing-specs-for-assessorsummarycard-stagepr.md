---
title: >-
  DESIGN-BRIEF §2 missing specs for AssessorSummaryCard, StageProgressStrip,
  RevisitModal; §9 missing their files
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:28:07Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

DESIGN-BRIEF §2 FB-56 extension callout (line 119) mandates:

> every component named in §2 of THIS brief — including `FeedbackStatusBadge`, `FeedbackOriginIcon`, `FeedbackItem` (compact + expanded), `FeedbackList`, `FeedbackSummaryBar`, `AgentFeedbackToggle`, `FeedbackSheet` (aka `MobileFeedbackPanel`), `FeedbackFloatingButton`, `AssessorSummaryCard`, `StageProgressStrip`, `RevisitModal` — MUST have an explicit row in `state-coverage-grid.md` §7. Adding a new component to §2 without simultaneously adding a row in the grid is a hard fail at the design-reviewer gate.

This callout claims those components ARE in §2. In practice, only the first eight (`FeedbackStatusBadge` through `FeedbackFloatingButton`) have component specs in §2. `AssessorSummaryCard`, `StageProgressStrip`, and `RevisitModal` are referenced in the callout but have NO component spec (no Props interface, no Tailwind pattern, no compact/expanded variants) in §2. They are defined only in their respective HTML artifacts (`assessor-summary-card.html`, `stage-progress-strip.html`, `revisit-modal-spec.html` / `revisit-modal-states.html`).

DESIGN-BRIEF §9 File Inventory also omits them — there is no `AssessorSummaryCard.tsx`, `StageProgressStrip.tsx`, or `RevisitModal.tsx` row. Dev-stage will see only `FeedbackSheet.tsx`, `FeedbackList.tsx`, etc. from §9 and miss these three entirely when planning file creation.

This is structural inconsistency between the brief's component callout, its §2 content, and its §9 file inventory. The state-coverage-grid §7.10–§7.12 covers them (cross-referenced to §5 / §4 / §7), but the BRIEF is the source of truth for dev-stage React component scaffolding.

Fix options (pick one):

A. Add full §2 component specs for `AssessorSummaryCard`, `StageProgressStrip`, `RevisitModal` — Props interface, Tailwind class pattern, states, accessibility contract — matching the depth of the other eight new-component specs. Add corresponding rows in §9 File Inventory: `review-app/src/components/AssessorSummaryCard.tsx`, `StageProgressStrip.tsx`, `RevisitModal.tsx` with "New".

B. Remove those three names from the FB-56 callout line 119 and explicitly scope it to the eight components actually specified in §2; cross-reference state-coverage-grid §5/§4/§7.10-7.12 as the source of truth for the three artifact-defined components.

Preference: option A (complete specs in DESIGN-BRIEF) — it matches the stated mandate and prevents dev-stage from guessing the Props signature or file name. Without it, dev-stage is free to invent file names, and downstream cross-references to these components (the `FB-62` aria-live-sequencing contract for `AssessorSummaryCard`, the `FB-65` roving-tabindex for `StageProgressStrip`, the `FB-58` tablist semantics for `RevisitModal`) land on components with no shared spec.
