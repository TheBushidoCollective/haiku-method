---
title: designer-prep hat references wrong path for inception DISCOVERY.md
status: closed
origin: adversarial-review
author: architecture
author_type: agent
created_at: '2026-04-28T23:52:36Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-04:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:52:36Z'
resolution: null
replies: []
---

**File:** `plugin/studios/software/stages/design/hats/designer-prep.md:4`

**Violation:** The hat instructs the agent to locate the inception `DISCOVERY.md` at `stages/inception/knowledge/DISCOVERY.md`. But the canonical location declared by the inception stage's own discovery template is `location: .haiku/intents/{intent-slug}/knowledge/DISCOVERY.md` — an **intent-scope** artifact, not a stage-scope artifact.

**Source of truth:**
- `plugin/studios/software/stages/inception/discovery/DISCOVERY.md:3` — `location: .haiku/intents/{intent-slug}/knowledge/DISCOVERY.md`

**What the hat says:**
- `plugin/studios/software/stages/design/hats/designer-prep.md:4` — "Locate the inception stage's `DISCOVERY.md` knowledge artifact at `stages/inception/knowledge/DISCOVERY.md` (or the intent's knowledge dir)"

The parenthetical fallback `(or the intent's knowledge dir)` acknowledges ambiguity but does not resolve it. The primary instruction points to a path that doesn't exist — there is no `stages/inception/knowledge/` directory; the file lands at `{intent-root}/knowledge/DISCOVERY.md`. An agent following the hat literally will fail on the first lookup and may fall back to the correct path only by guessing.

**Recommendation:** Change the path in `designer-prep.md:4` to `knowledge/DISCOVERY.md` (relative to the intent root), which matches what the inception discovery template actually declares. Remove the ambiguous parenthetical.
