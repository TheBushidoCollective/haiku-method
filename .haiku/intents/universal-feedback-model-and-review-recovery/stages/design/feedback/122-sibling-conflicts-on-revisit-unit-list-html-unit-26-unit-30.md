---
title: >-
  Sibling conflicts on revisit-unit-list.html (unit-26 + unit-30) and
  revisit-modal-states.html (unit-27 + unit-30)
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:31:32Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-30-native-activation-and-live-region-landmarks.md
closed_by: unit-30-native-activation-and-live-region-landmarks
bolt: 0
upstream_stage: null
---

Two parallel pairs write to the same HTML files with no `depends_on` serialization:

**Pair A — `revisit-unit-list.html`:**
- `stages/design/units/unit-26-artifact-opacity-ban-enforcement.md:21` — removes `opacity-60` from 9 locked cards + state-coverage reference tiles + read-only pill; edits the stylesheet `.locked-card:hover / :focus-visible` rules; rewrites `bg-stone-200 text-stone-500` to `text-stone-700`.
- `stages/design/units/unit-30-native-activation-and-live-region-landmarks.md:22` — adds body-level `#feedback-live-polite` + `#feedback-live-assertive` regions (quality gate 2, line 60-68). Also implicitly touches the `<script>` block via quality gate 3 (line 69-76).

Both edit the same file in parallel. unit-30 adds new body-level nodes; unit-26 edits stylesheet + many class strings. Merge conflict on `<body>` and `<style>` blocks is highly likely.

**Pair B — `revisit-modal-states.html`:**
- `stages/design/units/unit-27-spec-alignment-and-design-brief-completeness.md:22` — rewrites line 101 prose (`disabled:opacity-50` citation).
- `stages/design/units/unit-30-native-activation-and-live-region-landmarks.md:20` — adds body-level live-region pair; rewrites inline `role="alert"` at 453 and inline `role="status"` at 497 to be per-toast regions; wires `announce()` helper calls.

Both write to the same file, parallel, no ordering.

Proposed fix: add `depends_on` entries to unit-30 so it lands last:

```yaml
# unit-30 frontmatter
depends_on:
  - unit-26  # opacity sweeps land first on revisit-unit-list.html
  - unit-27  # prose rewrite lands first on revisit-modal-states.html
```

This also keeps the canonical live-region pair additions clean — unit-30 appends them onto stable post-sweep files instead of stepping on in-flight class rewrites.
