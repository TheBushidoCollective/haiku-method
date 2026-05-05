---
title: >-
  MCP tool name divergence: `haiku_drift_classify` (knowledge/ARCH) vs
  `haiku_classify_drift` (design + impl)
status: closed
origin: studio-review
author: cross-stage-consistency
author_type: agent
created_at: '2026-05-03T21:55:36Z'
iteration: 0
visit: 0
source_ref: null
closed_by: 'fix-loop:FB-04:bolt-1'
bolt: 1
triaged_at: '2026-05-03T21:55:36Z'
resolution: null
replies: []
hat: validator
iterations:
  - bolt: 1
    hat: reconciler
    completed_at: '2026-05-03T21:58:27Z'
    result: advanced
  - bolt: 1
    hat: validator
    completed_at: '2026-05-03T21:59:20Z'
    result: closed
---
## Finding

Second tool-naming divergence across stages, mirroring the `haiku_human_write_file` finding but inverted: this time it's the development stage's discovery artifact that uses a different name from the rest of the chain.

## The names

- **Development stage** (`knowledge/ARCHITECTURE.md`, the development-stage discovery output authored by `unit-03-implementation-map`): `haiku_drift_classify` — appears in 4 places (lines 355, 550, 580, 590 within the file as written; also in §3.5 the resource-tool surface lists `haiku_drift_classify`).
- **Design stage** (`stages/design/artifacts/ARCHITECTURE.md`, `MCP-TOOL-CONTRACT.md`): `haiku_classify_drift`.
- **Product stage** (`product/DATA-CONTRACTS.md` §4.3, `knowledge/DATA-CONTRACTS.md`): `haiku_classify_drift`.
- **Implementation** (`packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts`): `haiku_classify_drift`.

## Why this is a cross-stage finding

The development knowledge artifact (`knowledge/ARCHITECTURE.md`) is supposed to be the inception/discovery for development — it sets the architectural map the implementation references. But it independently invented a tool name (`haiku_drift_classify`) that diverges from the design-stage contract that the development units were instructed to implement against. The result: the document an engineer reads to orient themselves to the codebase points them at a non-existent tool name.

Note: the discovery's own §3.5 even hedges with "(working name)" in the comment next to `haiku_drift_classify`, suggesting the author knew the name wasn't final but published it anyway. The "working name" should have been reconciled to the design-stage final name before the discovery published.

## Why these two tool-name findings together matter

Both findings are about the same class of failure: cross-stage docs claim to be authoritative on the tool surface but disagree with each other and with the implementation. The MCP tool surface is the contract between agents and the workflow engine. A user (or auditor, or new contributor) reading product or development docs to find tool names finds wrong names. The contract is broken at the documentation level even though the implementation is consistent.

## Suggested resolution

Rename `haiku_drift_classify` → `haiku_classify_drift` everywhere it appears in `knowledge/ARCHITECTURE.md`. Drop the "(working name)" hedge in §3.5 — design has resolved the name, so it's no longer working.

## File:line refs

- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:355` — "haiku_drift_classify   # NEW (working name): record manual_change_assessment outcomes."
- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:550` — `haiku_drift_classify.ts` filename in directory tree
- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:580` — dependency arrow `haiku_drift_classify.ts ──→ drift-markers.ts`
- `.haiku/intents/out-of-band-human-file-modifications/knowledge/ARCHITECTURE.md:590,606` — "registers `haiku_human_write` and `haiku_drift_classify`"
- Design-final + impl name: `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts`
