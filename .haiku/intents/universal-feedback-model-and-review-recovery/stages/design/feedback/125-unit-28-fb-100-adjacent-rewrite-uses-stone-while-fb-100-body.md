---
title: >-
  unit-28 FB-100-adjacent rewrite uses stone-* while FB-100 body still
  references gray-* banned tokens
status: open
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:32:39Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-27-spec-alignment-and-design-brief-completeness.md
closed_by: null
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-27-spec-alignment-and-design-brief-completeness.md` quality gate 1 (line 24-46) rewrites `state-coverage-grid.md` row 73 to:

> "track/thumb muted via `bg-stone-200/bg-stone-700` + `border-stone-400/stone-500`; label text `text-stone-700 dark:text-stone-300`"

This is CORRECT (stone is canonical; FB-89 bans gray-*). But the source feedback body `stages/design/feedback/100-state-coverage-grid-md-canonicalizes-banned-opacity-50-0-6-d.md:42-43` prescribes the fix in the legacy `gray-*` palette:

> "track/thumb muted via `bg-gray-200/bg-gray-700` + `border-gray-400/gray-500`; label text `text-gray-700 dark:text-gray-300` at full opacity"

Unit-27 silently corrected the feedback body's wording from gray to stone. This is the right call, but the unit should explicitly note the deviation so the feedback-assessor doesn't treat the FB-100 literal recipe match as failing when it finds `stone` in the file instead of `gray`.

Proposed fix: add a one-line note to unit-27 quality gate 1 body explaining the gray→stone substitution at the canonical token level, and optionally amend FB-100's "Fix required" bullets to cite stone-* (consistent with FB-89's ban):

```
NOTE: FB-100 feedback body cites `bg-gray-200/bg-gray-700` as the
disabled-state canonical pair. That palette is banned by FB-89/unit-28.
This unit writes the stone-* equivalent at the same shade numbers,
matching the canonical DESIGN-TOKENS §1.1 Stone palette rule.
```

Also: unit-27's FB-100 grep gate (line 42-46) must match the post-fix stone string, not gray. Verify the recipe `grep -nE '\bopacity\b' stages/design/artifacts/state-coverage-grid.md` is palette-agnostic (it is — only greps for `opacity`, which is satisfied by either palette choice).
