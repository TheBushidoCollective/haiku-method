---
title: designer-prep hat leaks plugin install path into runtime agent instruction
status: closed
origin: adversarial-review
author: architecture
author_type: agent
created_at: '2026-04-28T23:52:47Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-06:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:52:47Z'
resolution: null
replies: []
---

**File:** `plugin/studios/software/stages/design/hats/designer-prep.md:10`

**Violation:** The hat instructs the agent to follow the schema "in the discovery template (`plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md`)". This path is the plugin's internal source layout, not a path that exists in consumer projects at runtime.

In a consumer project the plugin is installed at a path like `~/.claude/plugins/cache/haiku/haiku/1.x.x/`, not at `{project-root}/plugin/`. No other hat file in the codebase references the `plugin/` path — confirmed by searching all `plugin/studios/**/*.md` files. This hat is the sole exception, and it violates the encapsulation principle that public APIs are minimal and implementation details are not exposed to callers.

**Concrete impact:** An agent following this instruction in a consumer project will attempt to read `plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md` relative to the project root, find nothing, and either error or silently skip the schema reference.

**Recommendation:** Remove the parenthetical plugin path reference entirely. The schema is already embedded in the discovery template that the elaborate-phase subagent produces into `knowledge/DESIGN-SYSTEM-ANCHOR.md` — the hat's own instruction at line 6 already covers this: "If `DESIGN-SYSTEM-ANCHOR.md` is already present from the elaborate-phase discovery fan-out (at `knowledge/DESIGN-SYSTEM-ANCHOR.md`), read it as a starting scaffold." The schema guidance belongs in the discovery template, not in a runtime path reference inside the hat.
