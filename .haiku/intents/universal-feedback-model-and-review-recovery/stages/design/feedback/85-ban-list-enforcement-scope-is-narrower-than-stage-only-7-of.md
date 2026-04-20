---
title: >-
  Ban-list enforcement scope is narrower than stage — only 7 of 33+ artifacts
  are grep-audited
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T03:00:25Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

Meta-finding: the unit-11 / unit-17 / unit-18 / unit-19 verification greps all iterate over a fixed list of 7 "input" artifacts declared in each unit's frontmatter:

```
for f in feedback-inline-desktop feedback-inline-mobile feedback-card-states \
         comments-list-with-agent-toggle assessor-summary-card revisit-modal-spec \
         annotation-popover-states; do …
```

But the design stage ships **33 artifacts** at `stages/design/artifacts/`. The remaining 26 artifacts are never grep-audited against the bans (`text-[9px]`, `text-[10px]`, `opacity-50`, `opacity-70`, banned foreground/background pairs). This explains why:

- `revisit-modal-states.html` has `text-[9px]` at L567 (FB-78) — not in the 7-input list.
- `agent-feedback-toggle-spec.html` has `text-[10px]` + `text-gray-400 dark:text-gray-500` at L89, L107, L125 (FB-77) — not in the list.
- `keyboard-shortcut-map.html:553` has `text-[10px] text-stone-400 dark:text-stone-500` — not in the list.
- `annotation-gesture-spec.html`, `review-flow-with-feedback-assessor.html`, `review-package-structure.html`, `review-ui-mockup.html`, `stage-progress-strip.html`, `rollback-reason-banner.html`, `skip-link-spec.html`, `state-signaling-inventory.html`, `revisit-unit-list.html`, `feedback-lifecycle-transitions.html`, `comment-to-feedback-flow.html`, `footer-button-copy-spec.md`, `motion-and-reduced-motion-spec.md`, `component-inventory.md`, `focus-ring-spec.html`, etc. — none are audited.

**Why this is a stage-wide a11y failure:**

1. Each of these artifacts is a dev-stage handoff reference. If any ship banned tokens, dev inherits them.

2. The bans are codified in `DESIGN-TOKENS.md §1.1a` (contrast) and §3 (type). `DESIGN-TOKENS.md` is cross-cutting — it applies to every artifact, not a subset. So the enforcement grep has to match the scope of the rule.

3. The review-agent (this review) has to manually spot-check each non-input file because the audit doesn't. That's not scalable and it hides failures behind trust.

**Fix:**

1. Change every audit grep from iterating 7 hard-coded files to iterating `stages/design/artifacts/*.html` (and `*.md` where applicable):
```bash
find stages/design/artifacts/ -name '*.html' | while read f; do
  echo "$(basename $f): $(grep -cE 'text-\[9px\]|text-\[10px\]' $f)"
done
# every line must end in 0
```

2. Add a stage-wide sanity grep to a `verification/` artifact or to the unit-11/17/18/19 completion-criteria:
```bash
grep -rEn 'text-\[9px\]|text-\[10px\]|\bopacity-50\b|\bopacity-70\b|disabled:opacity-' stages/design/artifacts/ | tee /tmp/a11y-ban-violations.txt
# must be empty
```

3. Update `aria-landmark-spec.md §9` "Verification checklist" to run greps stage-wide rather than per-artifact, and to fail the design gate if any violation is found.

This is the root cause of FB-77, FB-78, FB-79, and several earlier FB items that kept regressing. Fix the audit scope, not just the individual files.
