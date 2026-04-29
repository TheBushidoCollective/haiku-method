---
title: >-
  designer-prep hat: wrong primary path for DISCOVERY.md — agent will fail to
  read Existing Code Structure section
status: closed
origin: adversarial-review
author: correctness
author_type: agent
created_at: '2026-04-28T23:54:10Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-10:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:54:10Z'
resolution: null
replies: []
---

## Finding

`plugin/studios/software/stages/design/hats/designer-prep.md`, line 4:

```
- Locate the inception stage's `DISCOVERY.md` knowledge artifact at `stages/inception/knowledge/DISCOVERY.md` (or the intent's knowledge dir) …
```

The primary path `stages/inception/knowledge/DISCOVERY.md` does not exist. The inception stage's `DISCOVERY.md` template declares:

```yaml
location: .haiku/intents/{intent-slug}/knowledge/DISCOVERY.md
scope: intent
```

`scope: intent` means the artifact is written to the **intent-level knowledge directory** (`.haiku/intents/{slug}/knowledge/DISCOVERY.md`), not to a stage-scoped path. There is no `stages/inception/knowledge/` directory; that path resolves to nothing on every real intent.

The fallback clause `(or the intent's knowledge dir)` is present but gives no specific path, leaving the agent to guess. Compare the designer hat's correct references:

- `knowledge/DESIGN-SYSTEM-ANCHOR.md` (line 4 of designer.md) ← correct relative form
- `knowledge/DESIGN-TOKENS.md` (line 5 of designer.md) ← correct relative form

The designer-prep hat should use the same form: `knowledge/DISCOVERY.md`.

## Impact

The designer-prep hat's core job is to read prior-art file references and era tags from `DISCOVERY.md`'s `## Existing Code Structure` section. If it cannot locate that document (because the primary path fails and the fallback is vague), it will either skip the section or invent file references — directly defeating the intent of issue #263 items 1, 3, 4, and 6.

## Fix

In `plugin/studios/software/stages/design/hats/designer-prep.md` line 4, change:

```
- Locate the inception stage's `DISCOVERY.md` knowledge artifact at `stages/inception/knowledge/DISCOVERY.md` (or the intent's knowledge dir) …
```

to:

```
- Locate the inception stage's `DISCOVERY.md` knowledge artifact at `knowledge/DISCOVERY.md` …
```

This matches the canonical `scope: intent` location and the path form used by every other cross-knowledge reference in the design hats.

## Resolution (bolt 1, builder)

Edited `plugin/studios/software/stages/design/hats/designer-prep.md` line 4. Replaced the wrong primary path `stages/inception/knowledge/DISCOVERY.md` and vague fallback `(or the intent's knowledge dir)` with the canonical relative form `knowledge/DISCOVERY.md`. Now matches the form designer.md uses on its line 4 (`knowledge/DESIGN-SYSTEM-ANCHOR.md`) and line 5 (`knowledge/DESIGN-TOKENS.md`), and resolves correctly against the DISCOVERY.md template's `scope: intent` / `location: .haiku/intents/{intent-slug}/knowledge/DISCOVERY.md`.
