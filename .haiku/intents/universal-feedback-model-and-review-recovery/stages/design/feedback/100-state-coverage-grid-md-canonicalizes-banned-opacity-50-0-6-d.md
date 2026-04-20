---
title: >-
  state-coverage-grid.md canonicalizes banned opacity-50/0.6 disabled state
  across 5 rows — spec contradicts ban
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:28:32Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-27-spec-alignment-and-design-brief-completeness
---

`state-coverage-grid.md` is supposed to be the canonical state-coverage reference for every interactive surface, but it canonicalizes the banned `opacity-50` / `opacity 0.6` disabled patterns across five rows. These spec contradictions directly cause the repeat violations that unit-18 has been chasing for five bolts.

**Live violations (grep verified 2026-04-19):**

- `state-coverage-grid.md:52` — Feedback card (compact) row:
  > "disabled | ✓ (opacity 0.6 when read-only/locked)"
  Canonicalizes `opacity 0.6` as the designated disabled treatment for feedback cards, which is exactly the pattern QG1-extended bans on card/button roots with text children.
- `state-coverage-grid.md:73` — `AgentFeedbackToggle` row:
  > "disabled | ✓ (`aria-disabled=\"true\"`, cursor-not-allowed, opacity-50)"
  Canonicalizes `opacity-50` as the disabled pattern for the toggle, contradicting `contrast-and-type-audit.md §4 Bolt-4 row 4` which says this was removed in favor of `bg-gray-200 ... text-gray-700 dark:text-gray-300` at full opacity.
- `state-coverage-grid.md:132` — Revisit-unit-list Locked card row:
  > "default | ✓ (opacity 0.6) | hover | ✓ (opacity 0.8) | focus | ✓ (opacity 0.95 + teal ring)"
  Canonicalizes the entire "opacity as state" palette that bolt-3 (lines 494-498 of the audit) claims was rewritten to use muted-background tokens with dashed borders instead of opacity.
- `state-coverage-grid.md:150` — `FeedbackStatusBadge` row:
  > "disabled | N/A — there is no 'disabled badge' state; the owning card goes to opacity 0.6, the badge stays full-contrast"
  Same canonicalization problem — says the owning card "goes to opacity 0.6" (banned).
- `state-coverage-grid.md:190` — §7.7 `AgentFeedbackToggle` row:
  > "disabled | ✓ (`aria-disabled=\"true\"`, opacity-50, cursor-not-allowed, track gray-200)"
  Same contradiction as line 73.

**Why this is a blocker for the feedback-assessor gate:**

A spec that canonicalizes the banned pattern in the table reviewers reference is the mechanism by which violations keep coming back. The design-reviewer can legitimately cite this table when rejecting a "remove opacity-60" fix, because the spec says opacity-60 is the canonical disabled treatment. The contradiction has to be resolved in the spec BEFORE the QG1/QG1-extended grep enforcement can be trusted.

**Fix required:**

1. Rewrite line 52 to describe the canonical muted-background disabled treatment (e.g. "✓ (`bg-stone-100 dark:bg-stone-800` + `text-stone-600 dark:text-stone-300` + dashed border; `aria-disabled=\"true\"`; no opacity)").
2. Rewrite lines 73 and 190 to describe `AgentFeedbackToggle` disabled as "track/thumb muted via `bg-gray-200/bg-gray-700` + `border-gray-400/gray-500`; label text `text-gray-700 dark:text-gray-300` at full opacity; `aria-disabled=\"true\"`; cursor-not-allowed. No `opacity-*` on the wrapper."
3. Rewrite line 132 (locked-card row) to describe the new state treatments from §6.3 of `contrast-and-type-audit.md` (dashed stone border + muted surface; hover = surface lifts to `bg-stone-100`; focus = teal ring on muted surface). Drop every `opacity-*` reference.
4. Rewrite line 150 so the badge row's rationale does not mention "opacity 0.6" at all.

Until the spec matches the ban, the ban will keep getting re-violated.

**WCAG refs (downstream):** 1.4.3 Contrast (Minimum) for every surface the spec canonicalizes.
