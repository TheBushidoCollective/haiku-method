---
title: >-
  baseline.json scoped per-stage but drift-markers.json is intent-scoped —
  storage topology is inconsistent
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T20:34:45Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-24:bolt-2'
bolt: 2
triaged_at: '2026-04-29T20:34:45Z'
resolution: null
replies: []
hat: feedback-assessor
iterations:
  - bolt: 2
    hat: product
    completed_at: '2026-04-29T21:45:02Z'
    result: advanced
  - bolt: 2
    hat: feedback-assessor
    completed_at: '2026-04-29T21:45:59Z'
    result: closed
---
**Mandate lens:** Data contracts must be compatible with existing schemas; edge cases must have defined behavior.

**Finding:**

`DATA-CONTRACTS.md §2.1` (Baseline) states:
> Storage reference: `stages/{stage}/baseline.json` inside the intent directory. One file per stage.

`DATA-CONTRACTS.md §2.2` (PendingMarker) states:
> Storage reference: Intent-scoped sidecar at `.haiku/intents/{slug}/drift-markers.json`. Not stage-scoped, because cross-stage markers may be open while a later stage is active.

These two topologies are inconsistent in a way that creates an undefined edge case: when a `PendingMarker` references a file in `stages/design/artifacts/` but the `Baseline` entry is in `stages/design/baseline.json`, the drift gate at tick time must:

1. Enumerate per-stage `baseline.json` files to find the file's entry.
2. Check the intent-scoped `drift-markers.json` to see if a marker is open.
3. Look up `stage` from the `Baseline` entry to know which `baseline.json` to update at clearance time.

But `DATA-CONTRACTS.md §4.4` (`haiku_baseline_clear_marker`) takes only `intent_slug` and `path` as inputs — it does not take `stage`. The tool must therefore derive the stage from the `path` field by parsing the `stages/{stage}/...` prefix. This parsing rule is not defined in the contract. What happens to a `knowledge/` path (which is not prefixed with `stages/{stage}/`)? The `Baseline` stores `stage: null` for intent-scope files, but `haiku_baseline_clear_marker` has no `stage` input and no mention of the null-stage case.

**Impact:** The tool contract is under-specified for non-stage-prefixed paths. Development stage will infer parsing rules from the path structure — a convention that is not normative.

**Location:** `DATA-CONTRACTS.md §2.1` (Baseline storage), §2.2 (PendingMarker storage), §4.4 (haiku_baseline_clear_marker request schema — no `stage` field).
