---
title: designer-prep hat reads wrong path for inception DISCOVERY.md
status: closed
origin: adversarial-review
author: completeness (from product)
author_type: agent
created_at: '2026-04-28T23:53:00Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-07:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:53:00Z'
resolution: null
replies: []
---

## Finding

`plugin/studios/software/stages/design/hats/designer-prep.md` (line 4) instructs the hat to locate the inception DISCOVERY.md at:

```
stages/inception/knowledge/DISCOVERY.md
```

But the inception DISCOVERY.md discovery template (`plugin/studios/software/stages/inception/discovery/DISCOVERY.md`) declares:

```yaml
location: .haiku/intents/{intent-slug}/knowledge/DISCOVERY.md
```

The artifact is written to the **intent-level knowledge dir** (`knowledge/DISCOVERY.md`), not to a stage-specific `stages/inception/knowledge/` path. That subdirectory does not exist in the workflow engine's filesystem layout.

## User-facing impact

When designer-prep runs `During elaborate`, it will attempt to read `stages/inception/knowledge/DISCOVERY.md` and find nothing. The `## Existing Code Structure` section it needs to enumerate prior-art files will not be found. The hat's mandate gives no instruction for what to do when the path returns empty — it silently continues without the era-tagged file list, defeating the entire purpose of unit-01 and unit-03.

## Missing scenarios

- **Happy path** not fully specified: the hat reads `knowledge/DISCOVERY.md` (correct path), finds an `## Existing Code Structure` section, enumerates era-tagged files, extracts tokens.
- **Error/edge case** not specified: inception DISCOVERY.md exists at the intent-level knowledge dir but has no `## Existing Code Structure` section (intent predates unit-03). No instruction given — hat must have a defined behavior (record open question, proceed with token extraction only from atorasu source directly).
- **Missing inception entirely** is handled (the hat says "read each source file listed there that relates to the design system") but the graceful fallback path is not separated from the success path.

## Required fix

In `plugin/studios/software/stages/design/hats/designer-prep.md`, change line 4 from:

> Locate the inception stage's `DISCOVERY.md` knowledge artifact at `stages/inception/knowledge/DISCOVERY.md`

to:

> Locate the inception stage's `DISCOVERY.md` knowledge artifact at `knowledge/DISCOVERY.md` (the intent-level knowledge dir — this is where all discovery artifacts land per the discovery template's `location:` field)

Also add an explicit edge-case instruction: "If the file does not contain a `## Existing Code Structure` section (e.g. inception predated unit-03's era-tagging), proceed directly to token extraction from atorasu source and record the absence as an open question in the anchor artifact."
