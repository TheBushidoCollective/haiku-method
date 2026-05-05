---
title: Drift Detection
description: How H·AI·K·U detects and responds to out-of-band file changes between agent ticks
order: 42
---

Not every file change flows through the agent. A product owner might drop a revised requirements doc into the stage knowledge directory. A designer might replace a mockup between bolts. Without explicit acknowledgment, the agent's next tick would treat those files as unchanged — producing an assessment built on stale inputs.

Drift detection closes that gap. Before each tick, the framework scans the tracked surface and surfaces any divergence for the agent to classify.

## How It Works

Every tracked file gets a SHA-256 digest recorded in a per-stage baseline (`stages/{stage}/baseline.json`). Before any other work runs on a tick, the drift-detection gate:

1. Computes the current digest for every file in the tracked surface.
2. Compares against the stored baseline.
3. If any digests differ (or files were added or deleted), emits a `manual_change_assessment` action.

The agent classifies each finding before the tick proceeds. Normal stage dispatch resumes only after every finding is classified.

## Tracked Surfaces

The gate watches four surface areas within an intent:

| Surface | Path | Tracking class |
|---|---|---|
| Stage outputs | `stages/{stage}/artifacts/` | `stage-output` |
| Stage outputs (alias) | `stages/{stage}/outputs/` | `stage-output` |
| Stage knowledge | `stages/{stage}/knowledge/` | `knowledge` |
| Stage discovery | `stages/{stage}/discovery/` | `knowledge` |
| Intent-scope knowledge | `knowledge/` (at intent root) | `knowledge` |

Workflow-managed files (`units/*.md`, `feedback/*.md`, `intent.md`, `state.json`) and drift-subsystem files (`baseline.json`, `drift-markers.json`) are excluded from tracking.

## Classification Outcomes

When the agent receives a `manual_change_assessment` action it must classify each finding with one of four outcomes:

| Outcome | When to use | Effect |
|---|---|---|
| `ignore` | Cosmetic or expected change — punctuation, whitespace, minor PO edit | Baseline updated to current SHA; finding suppressed on future ticks |
| `inline-fix` | Agent incorporates the change immediately (e.g. folding PO additions into the current plan) | Baseline updated; no feedback item created |
| `surface-as-feedback` | Change warrants a structured feedback item and a fix loop | PendingMarker written; baseline NOT updated; feedback created |
| `trigger-revisit` | Change is significant enough to require revisiting an earlier stage | PendingMarker written; revisit dispatched to the target stage |

For `surface-as-feedback`, the agent must supply either an existing feedback ID (`linked_feedback_id`) or create a feedback item inline (`feedback_creates`).

For `trigger-revisit`, the agent must name the target stage (`linked_revisit_target_stage`). The target must be at or before the active stage — forward revisits are not permitted.

## Authorship Attribution

The baseline records who made each change:

| `author_class` | Meaning |
|---|---|
| `agent` | Written by the agent through normal workflow tools |
| `human-via-mcp` | Written via `haiku_human_write` or the SPA upload panel — explicit human attribution |
| `human-implicit` | SHA changed without an action-log entry — file was modified out-of-band |

Use `haiku_human_write` when acting on explicit human instructions. It stamps a `human-via-mcp` entry in the action log so the gate can attribute the change correctly, and the classifier preserves that attribution in the updated baseline entry.

## The `haiku_human_write` Companion Tool

`haiku_human_write` is the agent-callable tool for writing files on behalf of a human. Call it when a user says "save this config to knowledge/" or "update the spec with these changes." It:

- Writes the file atomically.
- Stamps a `human-via-mcp` action-log entry at the current tick counter.
- Appends a write-audit record to `write-audit.jsonl`.
- Does **not** update `baseline.json` — the next tick's drift gate observes the new SHA and dispatches a `manual_change_assessment`.

The distinction between `haiku_human_write` and a direct file write is authorship. Both paths are picked up by the drift gate; only `haiku_human_write` records who wrote the file.

## Pending Markers

When a finding is classified as `surface-as-feedback` or `trigger-revisit`, the gate writes a PendingMarker for that file's path. On the next tick, if the file's SHA still matches the marker's `baseline_sha_at_creation`, the gate suppresses re-detection — the finding is already being handled.

If the file changes again before the marker is cleared (a "double-edit"), the marker is treated as stale, removed, and a fresh assessment is dispatched. This prevents a resolved marker from silently suppressing a new divergence.

## Kill-Switch

Set `drift_detection: false` in `.haiku/settings.yml` to disable drift detection project-wide:

```yaml
# .haiku/settings.yml
drift_detection: false
```

With the kill-switch active, the gate is a complete no-op — no baseline reads, no surface enumeration, no findings. Disable only when all surface changes are guaranteed to flow through agent tools.

## Glossary

**Baseline** — The per-stage SHA-256 snapshot (`stages/{stage}/baseline.json`) used as the reference for drift comparison.

**Drift** — Any difference between the current on-disk SHA of a tracked file and its baseline entry.

**PendingMarker** — A record written when a finding is classified as `surface-as-feedback` or `trigger-revisit`. Suppresses re-detection of the same SHA on subsequent ticks.

**Assessment** — The record written by `haiku_classify_drift` capturing the agent's classification decisions for a single `manual_change_assessment` dispatch. Stored at `stages/{stage}/drift-assessments/DA-NN.json`.
