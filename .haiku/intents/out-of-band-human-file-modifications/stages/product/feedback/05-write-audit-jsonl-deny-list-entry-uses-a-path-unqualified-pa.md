---
title: >-
  write-audit.jsonl deny-list entry uses a path-unqualified pattern that will
  not reliably match intent-relative paths
status: addressed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T03:42:29Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 3
triaged_at: '2026-04-29T03:42:29Z'
resolution: null
replies: []
hat: product
iterations:
  - bolt: 3
    hat: product
    completed_at: '2026-04-29T03:59:06Z'
    result: advanced
---
## Finding

DATA-CONTRACTS.md §4.1 (`haiku_human_write`) lists the deny-list for path validation. The deny entries include: `units/*.md`, `feedback/*.md`, `intent.md`, `state.json`, `baseline.json`, `drift-markers.json`, `write-audit.jsonl`.

The `agent-writes-on-behalf-of-human.feature` (line 93) places `write-audit.jsonl` at the intent-scope path: `.haiku/intents/{demo-intent}/write-audit.jsonl`. When a caller passes `path = "write-audit.jsonl"`, the bare deny pattern would match. But the feature (line 129) also covers a path denial scenario for this case, suggesting the deny rule is `write-audit.jsonl` unqualified.

The problem: `haiku_human_write` accepts both intent-relative and absolute paths (per §4.1 request table: "Intent-relative or absolute (resolved to intent-relative)"). A caller passing `stages/design/write-audit.jsonl` (stage-relative) or an absolute path that normalizes to `write-audit.jsonl` at a non-intent-root location would not match the bare pattern. The deny rule is underspecified.

More critically: the feature scenario at line 128 tests writing TO `write-audit.jsonl` — but that path in the actual intent layout is at the intent root, not relative to a stage. The deny-list pattern must use the same path-normalization that the tool uses when resolving the `path` input. If that normalization is not defined in the product stage, the deny enforcement is ambiguous.

**Impact:** Development cannot implement the deny rule reliably without knowing: (a) the exact normalization algorithm applied to the `path` input before deny-list matching, (b) whether the deny pattern is a suffix match, a glob, or an exact match, (c) whether stage-scoped paths to the same filename are also denied.

**Fix required:** DATA-CONTRACTS.md §4.1 must specify the path-normalization algorithm (or cite it by reference to a design-stage artifact) and clarify whether deny patterns are suffix matches, full-path patterns, or glob patterns. The `write-audit.jsonl` deny entry should be updated to reflect the canonical intent-relative path (`write-audit.jsonl` at intent root) vs. whether `stages/*/write-audit.jsonl` is also denied.
