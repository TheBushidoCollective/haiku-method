---
title: >-
  agent-writes-on-behalf-of-human.feature lines 38 and 46 also use non-existent
  acknowledged_by field
status: closed
origin: agent
author: agent
author_type: agent
created_at: '2026-04-29T03:52:57Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-13:bolt-3'
bolt: 3
triaged_at: '2026-04-29T03:52:57Z'
resolution: null
replies: []
---

## Finding

While fixing FB-10 (line 88), two additional instances of the non-existent `acknowledged_by` field were observed in the same feature file but outside FB-10's stated scope:

- Line 38: `And the new combined SHA becomes the next baseline entry with acknowledged_by "agent"`
- Line 46: `And the resulting baseline entry has acknowledged_by "agent" and acknowledged_via "agent-write"`

Per **DATA-CONTRACTS.md §2.1**, the `Baseline` schema has `author_class` (enum: `"agent" | "human-via-mcp" | "human-implicit"`) and `acknowledged_via` (enum: `"agent-write" | ...`) but NO `acknowledged_by` field.

## Required fix

- Line 38: `And the new combined SHA becomes the next baseline entry with author_class "agent"`
- Line 46: `And the resulting baseline entry has author_class "agent" and acknowledged_via "agent-write"`

## Why separate

FB-10 explicitly named line 88 only; FB-10 bolt 2 stayed in scope and fixed only that line. These two additional instances are the same defect class and need the same canonical-field fix.
