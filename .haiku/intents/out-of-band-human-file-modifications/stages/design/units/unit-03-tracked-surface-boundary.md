---
title: Tracked-surface boundary spec
model: sonnet
depends_on:
  - unit-01-architecture-spec
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - knowledge/DESIGN-DECISIONS.md
  - knowledge/IMPLEMENTATION-MAP.md
  - stages/design/artifacts/ARCHITECTURE.md
outputs:
  - stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md
status: completed
bolt: 1
hat: design-reviewer
started_at: '2026-04-28T19:59:14Z'
hat_started_at: '2026-04-28T20:02:58Z'
iterations:
  - hat: designer
    started_at: '2026-04-28T19:59:14Z'
    completed_at: '2026-04-28T20:02:58Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-28T20:02:58Z'
    completed_at: '2026-04-28T20:03:30Z'
    result: advance
completed_at: '2026-04-28T20:03:30Z'
---
# Tracked-surface boundary spec

Define which files inside an intent are part of the "tracked surface" — the set the pre-tick drift gate baselines and watches. Inception's DISCOVERY.md flagged this as a deliberate open question for design. Without a precise boundary, drift detection is either too narrow (misses real edits) or too broad (generates false positives on workflow-internal churn). Output: a boundary spec the architecture and development units consume.

## Path-naming reconciliation (READ FIRST)

The `software` studio's STAGE.md files use **one canonical output directory per stage**, declared via STAGE.md's `outputs:` field. Across the codebase this is most often `stages/{stage}/artifacts/` (e.g. `inception/artifacts/`, `design/artifacts/`). Some prior intents and the design DESIGN-BRIEF.md sketch screens that reference `stages/{stage}/outputs/...` as a hypothetical replaceable-output area. **For this intent's purposes, the canonical name is `artifacts/`.** Anywhere DESIGN-BRIEF.md or DISCOVERY.md uses `outputs/`, the implementation maps to `artifacts/`. The boundary spec MUST use `artifacts/` consistently and explicitly note the alias.

## Scope

The TRACKED-SURFACE-BOUNDARY.md must specify, with explicit include/exclude rules:

- **In-scope (tracked, drift-checked)**:
  - Stage knowledge artifacts: `stages/{stage}/knowledge/**` and the intent-scope `knowledge/**`
  - Stage outputs (canonical): `stages/{stage}/artifacts/**` and any other paths declared in `STAGE.md`'s `outputs:` field
  - Stage discovery artifacts produced by fan-out subagents: `stages/{stage}/discovery/**`
  - Replaceable artifacts (figma exports, generated HTML, screenshots, design tokens) — these all live under `stages/{stage}/artifacts/**`. Where DESIGN-BRIEF.md and earlier sketches reference `outputs/`, the implementation MUST treat that as an alias for `artifacts/` and pick one canonical name throughout this document.
- **Out-of-scope (NOT tracked, deliberately excluded)**:
  - Workflow-managed files: `units/*.md`, `feedback/*.md`, `intent.md`, `stages/{stage}/state.json` — these are policed by the existing PreToolUse hook at the agent level and have separate integrity guarantees (tamper-detection gate). Drift detection on these would create double-coverage that conflicts with the existing tamper logic.
  - Audit logs and lifecycle records: `stages/{stage}/decision_log.json`, `stages/{stage}/audit/**` — append-only, no reason to detect drift
  - The intent worktree's own `.git/**` directory and any files under `.haiku/worktrees/**` (these are infrastructure, not content)
  - Files outside `.haiku/intents/{slug}/**` (source code, configs) — not part of any single intent's surface
- **Per-stage flexibility** — STAGE.md MAY declare additional `tracked_paths:` patterns beyond the defaults (e.g. a custom output directory). Defaults are sufficient for software-studio stages.
- **First-tick-after-deploy behavior** — when an intent is upgraded to a build that includes this feature, the first pre-tick drift gate run establishes baselines for every in-scope file without firing drift events. Subsequent ticks use the established baselines.
- **New-file detection** — a file appearing under a tracked path that has no baseline is treated as a human-implicit author-class write (NOT as drift, because there's nothing to diff against). The agent's classification step decides whether to integrate it (as new knowledge), surface it as feedback, or trigger revisit.
- **File-deletion detection** — a previously-baselined file that disappears from disk fires a drift event with `change_type: deleted`. The classification step decides whether to restore from baseline or accept the deletion.
- **Binary file handling** — files matching binary extensions (`.png`, `.jpg`, `.figma`, `.pdf`, etc.) are baselined by SHA only; the diff payload contains size + SHA + mime, not content. The agent classifies based on author-class + size delta + mime change.

## Completion Criteria

- TRACKED-SURFACE-BOUNDARY.md exists at `stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md` and is at least 3KB of substantive prose
- Document specifies the in-scope path patterns (≥4 distinct categories: knowledge, outputs/artifacts, discovery, replaceable artifacts) with glob-style examples; uses `artifacts/` as the canonical output-directory name and explicitly notes the `outputs/` alias from DESIGN-BRIEF.md
- Document specifies the out-of-scope path patterns (≥4 distinct exclusions: workflow-managed files, audit logs, infrastructure, files outside the intent) with glob-style examples and a one-line rationale per exclusion
- Document specifies how STAGE.md may declare additional `tracked_paths:` beyond defaults (extension point for non-software studios)
- Document specifies the first-tick-after-deploy "establish, don't fire" rule with explicit detail on how baseline establishment differs from drift detection
- Document specifies new-file behavior (treated as `human-implicit`, not as drift, classified anyway) and file-deletion behavior (drift event with `change_type: deleted`)
- Document specifies binary-file handling (SHA + size + mime, no content diff) and identifies the binary extension list (or a way to declare it)
- Document does NOT contain TypeScript file paths, function signatures, or shell commands — path patterns and contract rules only
- Document is internally consistent with ARCHITECTURE.md's baseline storage contract — every tracked path category maps to a known baseline storage entry shape
- Document explicitly addresses why workflow-managed files (units, feedback, intent.md, state.json) are excluded with reference to the existing tamper-detection gate (avoids double-coverage)
