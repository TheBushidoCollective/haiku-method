---
title: Drop-zone aria-label diverges between DESIGN-BRIEF and SPA-UI-SPECS
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T20:25:19Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-05:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:25:19Z'
resolution: null
replies: []
---

## Finding

The drop-zone `aria-label` string is specified in two places with different values:

- **DESIGN-BRIEF.md line 148:** `aria-label="Upload knowledge files. Drop files here or press Enter to browse."`
- **SPA-UI-SPECS.md §1.4 line 89:** `aria-label="Upload knowledge file"` — and the spec calls this "the exact string is required"

The wireframe (`wireframes/knowledge-upload.html` line 468) uses the SPA-UI-SPECS value: `"Upload knowledge file"`.

SPA-UI-SPECS.md §0 declares itself authoritative over DESIGN-BRIEF.md on named conflicts, but the aria-label divergence is not called out in §0's three explicitly resolved conflicts. So the resolution is implicit (the wireframe picks one, the brief names another) rather than explicit.

## Why this is a consistency issue

The `aria-label` is the primary screen-reader announcement for the drop zone. Developers implementing from DESIGN-BRIEF get a long descriptive label; developers implementing from SPA-UI-SPECS (which is authoritative) get a short label. The two strings have materially different verbosity — one announces affordances ("Drop files here or press Enter to browse"), the other does not. Accessibility behavior diverges depending on which document the developer reads first.

## Affected files

- `stages/design/DESIGN-BRIEF.md` line 148
- `stages/design/artifacts/SPA-UI-SPECS.md` §1.4, lines 41 and 89
- `stages/design/artifacts/wireframes/knowledge-upload.html` line 468

## Correct behavior

SPA-UI-SPECS.md is authoritative. DESIGN-BRIEF.md line 148's label string should be updated to match `"Upload knowledge file"` so developers reading either document see the same required string. Alternatively, SPA-UI-SPECS §0 should explicitly note this as a resolved conflict so the override is unambiguous.
