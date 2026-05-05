---
title: >-
  ARCHITECTURE.md §7.3 still references "Run now" button after SPA-UI-SPECS
  removed it
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T20:25:48Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-07:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:25:48Z'
resolution: null
replies: []
---

## Finding

`SPA-UI-SPECS.md §0` explicitly removes the "Run now ↻" button from the Drift-Detected Indicator surface as part of locking Direction A. The wireframes (`wireframes/drift-indicator.html`) correctly contain no "Run now" button.

However, `ARCHITECTURE.md §7.3` still describes the "Run now" button as a live, in-scope feature:

> "The 'Run now' button on the banner is the user-facing escape hatch for impatience — it triggers an immediate `haiku_run_next` call, which runs the gate and the classification action without waiting for the next scheduled tick."

`ARCHITECTURE.md` is a design-stage artifact produced by the same intent. It was written before Direction A was locked. SPA-UI-SPECS §0 supersedes DESIGN-BRIEF on the three named conflicts, and the first named conflict is explicitly the removal of the "Run now" button. But ARCHITECTURE.md is a separate document from DESIGN-BRIEF, and it still contains an affirmative description of the button's behavior.

## Why this is a consistency issue

A development-stage team reading ARCHITECTURE.md §7.3 will believe the "Run now" button is a required SPA element they need to implement. SPA-UI-SPECS §4.6 explicitly lists "Run now" button as a control that MUST NOT appear on any of the three surfaces. This is a direct functional contradiction between two design-stage artifacts that are both in scope for development.

## Affected file

`stages/design/artifacts/ARCHITECTURE.md` §7.3 (line 424): the sentence beginning "The 'Run now' button on the banner..."

## Correct behavior

The offending sentence in ARCHITECTURE.md §7.3 must be removed or updated to reflect Direction A. The sentence should describe the SPA-side UX accurately: the drift banner appears when drift is detected; it disappears automatically when the next `haiku_run_next` tick completes the `manual_change_assessment` action; there is no user-facing button to trigger the tick early. The paragraph should reference SPA-UI-SPECS §0 or §4.6 to anchor the passive-observer constraint.
