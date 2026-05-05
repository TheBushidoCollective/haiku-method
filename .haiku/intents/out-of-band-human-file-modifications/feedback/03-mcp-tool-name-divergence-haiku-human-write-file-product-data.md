---
title: >-
  MCP tool name divergence: `haiku_human_write_file` (product DATA-CONTRACTS) vs
  `haiku_human_write` (design + impl)
status: addressed
origin: studio-review
author: cross-stage-consistency
author_type: agent
created_at: '2026-05-03T21:55:00Z'
iteration: 0
visit: 0
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-03T21:55:00Z'
resolution: null
replies: []
hat: reconciler
iterations:
  - bolt: 1
    hat: reconciler
    completed_at: '2026-05-03T21:59:51Z'
    result: advanced
---
## Finding

The same tool is named two different things across stages, which is precisely the cross-stage naming consistency check the studio review mandate requires.

## The names

- **Product stage** (`product/DATA-CONTRACTS.md` §4.1, also re-published into `knowledge/DATA-CONTRACTS.md` §4.1): `haiku_human_write_file`.
- **Design stage** (`stages/design/artifacts/MCP-TOOL-CONTRACT.md` §2 — entire document is titled "MCP Tool Contract — `haiku_human_write`"): `haiku_human_write`.
- **Implementation** (`packages/haiku/src/tools/orchestrator/haiku_human_write.ts`, registered in `packages/haiku/src/tools/orchestrator/index.ts`): `haiku_human_write`.

## Why this is a cross-stage finding (not a stylistic preference)

The product stage's unit-03-data-contracts.md frontmatter explicitly says "matching the design-stage MCP-TOOL-CONTRACT.md names exactly":

> `unit-03-data-contracts.md:49`: "**MCP tool contracts** — `haiku_human_write_file`, `haiku_baseline_init`, `haiku_classify_drift`, `haiku_baseline_clear_marker` (matching the design-stage MCP-TOOL-CONTRACT.md names exactly)"

But the design contract document is titled and named `haiku_human_write` (no `_file` suffix), and the implementation matches the design name. So product's claim "matching design exactly" is false — it diverges by a literal `_file` suffix.

This propagates: `product/COVERAGE-MAPPING.md` lines 97, 99, 420, 680 cross-reference the misnamed tool, and `product/outputs/features/README.md:16` ties an entire feature file (`mcp_tools.feature`) to the wrong name.

A user reading the product spec believes the agent-conversation tool is `haiku_human_write_file`. Calling that tool fails — `tools/list` only exposes `haiku_human_write`. The spec is unimplementable on its own terms without a translation step.

## Suggested resolution

Pick one. The implementation matches design, so the cheap fix is rename in product/`DATA-CONTRACTS.md` (and the duplicate at `knowledge/DATA-CONTRACTS.md`), `product/COVERAGE-MAPPING.md`, `product/outputs/features/README.md`, `unit-03-data-contracts.md` references — drop the `_file` suffix everywhere it appears in the product stage.

## File:line refs

- `.haiku/intents/out-of-band-human-file-modifications/product/DATA-CONTRACTS.md:293` ("### 4.1 `haiku_human_write_file` — agent writes on behalf of human")
- `.haiku/intents/out-of-band-human-file-modifications/knowledge/DATA-CONTRACTS.md:256` (same)
- `.haiku/intents/out-of-band-human-file-modifications/stages/product/units/unit-03-data-contracts.md:49`
- `.haiku/intents/out-of-band-human-file-modifications/stages/product/units/unit-02-behavioral-specs.md:56`
- `.haiku/intents/out-of-band-human-file-modifications/product/COVERAGE-MAPPING.md:97,99,420,680`
- `.haiku/intents/out-of-band-human-file-modifications/product/outputs/features/README.md:16`
- Authoritative design name: `.haiku/intents/out-of-band-human-file-modifications/stages/design/artifacts/MCP-TOOL-CONTRACT.md:1` ("# MCP Tool Contract — `haiku_human_write`")
- Implementation: `packages/haiku/src/tools/orchestrator/haiku_human_write.ts`
