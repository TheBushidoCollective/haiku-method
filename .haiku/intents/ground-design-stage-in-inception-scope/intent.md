---
title: Ground design stage in inception scope
studio: software
mode: continuous
status: completed
created_at: '2026-04-28'
stages:
  - development
active_stage: development
intent_reviewed: true
phase: awaiting_completion_review
completion_review_entered_at: '2026-04-29T00:49:57Z'
completion_review_dispatched: true
completion_review_dispatched_at: '2026-04-29T00:50:00Z'
completed_at: '2026-04-29T01:42:21Z'
---

# Ground design stage in inception scope

Close three gaps from issue #263 that let the design stage drift from inception scope. Add a designer-prep hat that reads source (atorasu tokens/atoms) and produces a DESIGN-SYSTEM-ANCHOR.md artifact required by the designer hat and any design-stage subagents. Add a design-stage review-agent that audits produced artifacts against inception's DECISIONS.md / OPEN-QUESTIONS.md resolutions and UI-SURFACES coverage. Add an era/status field to inception's DISCOVERY.md template so prior-art file references can be tagged active / dormant / Stripe-era / Branch-era. Single-stage quick intent; one unit per concern. Closes #263.

User triaged GitHub issue #263 (design stage drifted from inception scope). Six framework-side suggestions clustered into three workstreams: (1) prior-art grounding via designer-prep hat + DESIGN-SYSTEM-ANCHOR.md, (2) inception coverage review-agent, (3) era-tagging in DISCOVERY.md. User chose to bundle all three into one quick-mode intent with a unit per concern, despite quick mode's single-stage guardrail.
