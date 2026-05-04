---
title: >-
  IMPLEMENTATION-MAP.md names specific file paths and implementation constructs
  — crosses into design territory
status: closed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-28T14:36:38Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-01:bolt-1'
bolt: 1
triaged_at: '2026-04-28T14:36:38Z'
resolution: null
replies: []
---

**File:** `.haiku/intents/out-of-band-human-file-modifications/knowledge/IMPLEMENTATION-MAP.md`

**Plugin Surface 1 (State Baseline Storage Layer)** contains this passage:

> "The storage format and location are design decisions (options include inline in `state.json`, a sidecar file alongside `state.json`, or a dedicated `baseline.json` per stage)"

This names specific file paths (`state.json`, `baseline.json`) as candidate storage locations. Naming `state.json` and `baseline.json` as specific file-path options is design-stage artifact specification, not a capability-level description. Per the inception mandate, units MUST NOT name file paths, module boundaries, or specific architecture patterns — those belong in the design stage.

**Plugin Surface 4 (Manual Change Assessment Workflow Action)** contains:

> "This action's addition requires a new case in the workflow engine's action dispatch table and new orchestrator logic for constructing the drift payload."

Prescribing "action dispatch table" and "orchestrator logic" is naming a specific architecture pattern (the implementation mechanism by which an action is registered). Inception should stop at "a new workflow action is needed" and leave the dispatch/registration mechanics to design.

**What needs to change:** Plugin Surface 1 should describe only the capability need ("a durable per-stage record of which files are at what content state") without listing candidate storage locations by name. Plugin Surface 4 should stop at "a new workflow action that presents drift findings and records classification decisions" without prescribing how the action integrates into the dispatch architecture.
