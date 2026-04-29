---
title: inception-coverage review agent reads design artifacts from wrong paths
status: closed
origin: adversarial-review
author: completeness (from product)
author_type: agent
created_at: '2026-04-28T23:53:16Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-08:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:53:16Z'
resolution: null
replies: []
---

## Finding

`plugin/studios/software/stages/design/review-agents/inception-coverage.md` Step 3 (lines 32-37) read design-stage outputs from a hardcoded two-line list, missing the design tokens and design-system anchor artifacts the designer hat depends on, and lacked a short-circuit when no design output exists yet.

## Root cause

Step 3 was static and incomplete. The designer hat (`plugin/studios/software/stages/design/hats/designer.md` lines 4-6) reads three primary inputs:

- `knowledge/DESIGN-SYSTEM-ANCHOR.md` (designer-prep extract)
- `knowledge/DESIGN-TOKENS.md` (token reference)
- `stages/design/DESIGN-BRIEF.md` (screen specs)

The discovery templates' `location:` fields confirm:

- `plugin/studios/software/stages/design/discovery/DESIGN-BRIEF.md` → `.haiku/intents/{intent-slug}/stages/design/DESIGN-BRIEF.md` (NOT `knowledge/`)
- `plugin/studios/software/stages/design/discovery/DESIGN-TOKENS.md` → `.haiku/intents/{intent-slug}/knowledge/DESIGN-TOKENS.md`
- `plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md` → `.haiku/intents/{intent-slug}/knowledge/DESIGN-SYSTEM-ANCHOR.md`

The review agent only read the brief and the artifacts dir. Token and anchor files were invisible, so token-vs-inception-constraint checks and anchor-vs-decision checks could not happen. There was also no defined behavior when the audit fired before any design output existed — risk of false surface-gap findings or crash.

(Note on FB's stated "required fix": the FB suggested moving DESIGN-BRIEF.md to `knowledge/DESIGN-BRIEF.md`. That contradicts the discovery template's `location:` field, which puts the brief at `stages/design/DESIGN-BRIEF.md`. The charitable interpretation per the file:line refs and the broader concern about coverage gaps is that Step 3 needs to enumerate ALL design-relevant outputs dynamically — same pattern as Step 1 for inception — and short-circuit cleanly when none exist. That is what was applied.)

## Fix

Rewrote Step 3 in `plugin/studios/software/stages/design/review-agents/inception-coverage.md` to:

1. Dynamically enumerate the four design-output locations (`stages/design/artifacts/`, `stages/design/DESIGN-BRIEF.md`, `knowledge/DESIGN-TOKENS.md`, `knowledge/DESIGN-SYSTEM-ANCHOR.md`), each with a citation to the discovery template or designer hat that owns it.
2. Short-circuit with an info-severity note ("No design artifacts found — coverage audit skipped") and clean return when none are present, mirroring Step 1's missing-inception short-circuit.
3. Extend the "MUST NOT summarize" rule to cover design outputs as well as inception artifacts.

## Files touched

- `plugin/studios/software/stages/design/review-agents/inception-coverage.md` (Step 3 rewrite)
