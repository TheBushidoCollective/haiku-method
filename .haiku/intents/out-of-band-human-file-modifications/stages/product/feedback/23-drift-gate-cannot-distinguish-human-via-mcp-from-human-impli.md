---
title: >-
  Drift gate cannot distinguish human-via-mcp from human-implicit — missing
  sidecar schema
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T20:34:28Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-23:bolt-2'
bolt: 2
triaged_at: '2026-04-29T20:34:28Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: product
    completed_at: '2026-04-29T21:47:42Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-04-29T21:48:45Z'
    result: closed
---
**Mandate lens:** Specified behavior must be implementable within the technical constraints. The spec must not assume capabilities that require unreasonable effort to build.

**Finding:**

`DATA-CONTRACTS.md §4.1` states for `haiku_human_write`:

> The baseline is **not** updated directly — the next tick's drift gate observes the SHA divergence, emits a `DriftFinding` with `author_class: "human-via-mcp"`, and dispatches `manual_change_assessment` to classify the write. This unified path applies to all three write channels.

For the drift gate to populate `author_class: "human-via-mcp"` in the `DriftFinding` (required by §3.1 and §6.1), it must know at tick time which path was written via the MCP tool rather than by a direct filesystem drop. The gate only sees on-disk SHA divergence — it has no way to distinguish `"human-via-mcp"` from `"human-implicit"` by inspecting the filesystem alone.

No sidecar schema is defined for this. The `write-audit.jsonl` file is append-only and denied for general reading (§4.1.2 deny-list uses `**/write-audit.jsonl`). There is no "pending-origin-stamp" record. Without a defined intermediate record (e.g., a pending-write-stamp at intent scope), the drift gate must classify all SHA mismatches as `"human-implicit"` — which is semantically wrong and breaks the audit attribution chain from `haiku_human_write` through to the `DriftFinding`.

**Impact:** Either `haiku_human_write` must write a machine-readable sidecar stamp (schema not defined in product stage), or the drift gate must read `write-audit.jsonl` (not in its defined data access scope), or `author_class` on `DriftFinding` must accept that `haiku_human_write` paths are indistinguishable from filesystem drops. None of these are specified.

**Location:** `DATA-CONTRACTS.md §4.1` (haiku_human_write behavior note), §2.1 (Baseline.author_class), §3.1 (DriftFinding.author_class), §6.1 (drift_detected event author_class).
