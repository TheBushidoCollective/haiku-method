---
title: >-
  agent-writes-on-behalf-of-human.feature references non-existent field
  acknowledged_by
status: closed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T03:43:16Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-10:bolt-1'
bolt: 0
triaged_at: '2026-04-29T03:43:16Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:08:06Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:11:54Z'
    result: closed
---
## Diagnosis

Root cause: `agent-writes-on-behalf-of-human.feature` and `DATA-CONTRACTS.md` used the non-existent field `acknowledged_by` with the non-canonical value `"human"` in multiple places. The canonical field per §2.1 is `author_class` with enum `"agent" | "human-via-mcp" | "human-implicit"`.

## Changes made (commit 22ae14a5)

### `features/agent-writes-on-behalf-of-human.feature`
- **Line 88**: `acknowledged_by "human"` → `author_class "human-via-mcp"` in the security review scenario's Then step. The sibling `acknowledged_via "human-write-tool"` clause was left unchanged (correct canonical field).

### `product/DATA-CONTRACTS.md`
- **§1 naming conventions table (line 29)**: Replaced freestanding `author_type: "human"` row (third alias, non-canonical) with `author_class: "human-via-mcp"` / `"human-implicit"` mapped to the canonical `Baseline` field.
- **§2.1 Baseline schema table (line 48)**: Renamed `acknowledged_by` → `author_class`; updated enum from `"agent" | "human" | "baseline-init"` to `"agent" | "human-via-mcp" | "human-implicit"` with clarifying notes.
- **§2.1 example JSON (line 63)**: `"acknowledged_by": "agent"` → `"author_class": "agent"`.
- **§4.1 tool purpose description**: `Baseline.acknowledged_by = "human"` → `Baseline.author_class = "human-via-mcp"`.
- **§4.3 side-effect ordering step 5**: `acknowledged_by = "agent"` → `author_class = "agent"`.
- **§5.1 HTTP API table**: `Baseline.acknowledged_by` provenance reference → `Baseline.author_class`.

## Verification

`grep -n "acknowledged_by"` on both files returns empty — no remaining occurrences. The `acknowledged_via` field and all its enum values are unchanged throughout both files.
