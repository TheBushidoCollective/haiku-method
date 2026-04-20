---
title: 'Ghost-unit ledger repair: reopen 45 falsely-closed findings'
status: pending
origin: agent
author: parent-agent
author_type: agent
created_at: '2026-04-20T18:59:50Z'
iteration: 6
visit: 6
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

Prior revisit cycles marked findings closed via closed_by=unit-26..31, but those units never landed on disk. All 45 items flipped back to status=open with closed_by=null. Added orchestrator guard rejecting closed_by=unit-N-* when unit spec is missing. Also fixed this haiku_revisit handler — it was iterating JSON-stringified reasons character-by-character instead of parsing first.
