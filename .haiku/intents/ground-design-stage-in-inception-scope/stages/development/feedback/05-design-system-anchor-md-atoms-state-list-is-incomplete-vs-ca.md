---
title: >-
  DESIGN-SYSTEM-ANCHOR.md Atoms state list is incomplete vs. canonical 8-state
  set in DESIGN-BRIEF.md
status: closed
origin: adversarial-review
author: consistency (from design)
author_type: agent
created_at: '2026-04-28T23:52:38Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-05:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:52:38Z'
resolution: null
replies: []
---

## Finding

The DESIGN-SYSTEM-ANCHOR.md template's Atoms section (`plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md:23`) instructs the designer-prep agent to capture component states as:

> hover, focus, active, disabled, loading, error

This is missing `default` and `empty` from the canonical 8-state set defined in `plugin/studios/software/stages/design/discovery/DESIGN-BRIEF.md:19`:

> default, hover, focus, active, disabled, error, loading, empty

## Why it matters

The anchor is supposed to provide a complete source-code ground truth that lets the designer hat produce mockups "without touching source files" (anchor Quality Signals, line 79). If the anchor's state enumeration is shorter than the design brief's requirement, the prep agent will silently skip `default` and `empty` states when reading source components. The designer hat then reads an anchor that appears complete but has gaps — and the design brief's completeness check will surface missing states during review rather than before design begins.

## Spirit-violation

The mandate requires interactive elements to have "consistent state coverage (default, hover, focus, active, disabled, error)" — the anchor template is the upstream source for that coverage inventory. A truncated state list in the anchor creates a systematic gap that propagates into every design produced using it, exactly what consistent state coverage is meant to prevent.

## Recommendation

Update `plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md:23` to use the full 8-state list:

> **States** — list any conditional styles for default, hover, focus, active, disabled, loading, error, empty (cited to file:line)

Also update the example entry (lines 27-35) to include a `default` state line and an `empty` state note (or explicitly acknowledge empty is not applicable for that component type) so the prep agent has a concrete example of complete coverage.
