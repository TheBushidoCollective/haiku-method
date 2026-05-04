---
title: Out-of-band human file modifications
studio: software
mode: autopilot
autopilot: true
status: completed
created_at: '2026-04-28'
stages:
  - inception
  - design
  - product
  - development
  - operations
  - security
active_stage: security
intent_reviewed: true
started_at: '2026-04-28T07:52:19-06:00'
phase: awaiting_completion_review
completion_review_entered_at: '2026-05-03T21:48:46Z'
completion_review_dispatched: true
completion_review_skipped: false
completed_at: '2026-05-04T02:10:44Z'
completion_review_dispatched_at: '2026-05-03T21:48:49Z'
---

# Out-of-band human file modifications

Users need a sanctioned way to modify intent-associated files outside the feedback loop — replacing stage outputs (figma/html/image), uploading knowledge into elaborate, or making small edits the agent should extend. Detection runs both ways: explicit (SPA upload UI, dedicated MCP tool, "hey claude write this file") and implicit (SHA baselines per stage stored in state, diffed by a pre-tick gate so pure filesystem drops are caught with no announcement). The workflow-managed file hook stays intact for agent writes (units/feedback/intent.md/state.json remain MCP-only); human writes via SPA/review-app/filesystem are out-of-band and not policed by hooks. On detected drift, a new workflow action `manual_change_assessment` fires — the agent reads the diff, classifies impact, and decides ignore / inline-fix / surface-as-FB / trigger revisit. Concurrency model is eventual-consistency: no locking, the next `haiku_run_next` tick observes drift and reacts. Sync surface: paper (new lifecycle concept), plugin (state baselines, pre-tick gate, new workflow action, MCP tool, SPA upload UI), website docs.
