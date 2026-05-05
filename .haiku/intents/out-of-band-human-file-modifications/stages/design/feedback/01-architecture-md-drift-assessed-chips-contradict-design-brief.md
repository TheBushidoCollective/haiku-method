---
title: >-
  ARCHITECTURE.md "drift assessed:" chips contradict DESIGN-BRIEF's "manual
  change pending" chip vocabulary
status: rejected
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-04-28T19:50:58Z'
iteration: 1
visit: 1
source_ref: 'design-reviewer hat, bolt 2, unit-01-architecture-spec'
closed_by: null
bolt: 1
triaged_at: '2026-04-28T19:50:58Z'
resolution: null
replies: []
---

## Finding

ARCHITECTURE.md §4.4 defines three terminal-state user-visible chips on artifact cards:

- §4.4.1 (`ignore`): *"a 'drift assessed: ignored' chip appears on the affected artifact card in the SPA Outputs tab. The chip clears on the next agent write to that file."*
- §4.4.2 (`inline-fix`): *"A 'drift assessed: folded in' chip appears on the artifact card."*
- §4.4.3 (`surface-as-feedback`): *"The affected artifact card in the Outputs tab shows a 'drift assessed: feedback opened' chip with a link to the feedback item."*

DESIGN-BRIEF.md never specifies these chips. The brief's Screen 2 (line 284) and Screen 3 navigation flows (line 413) define exactly **one** chip in this lifecycle:

> a new "manual change pending" chip in the footer.
> changed cards get the `border-l-amber-400` left-stripe + "manual change pending" chip **until the assessor publishes its disposition**.

DESIGN-BRIEF treats the chip as a transient *pending* indicator that disappears when assessment completes. ARCHITECTURE flips that contract: it specifies *terminal-state* chips that appear *after* assessment completes and persist until the next agent write.

## Why this is in scope (design-system consistency)

The design-reviewer mandate requires cross-referencing component usage against the existing design system. DESIGN-BRIEF.md is the canonical design-surface spec for this intent's user-facing components. ARCHITECTURE.md is introducing UI chip vocabulary — with specific labels, lifecycles, and clearance rules — that the developer will implement. If the architecture and design brief disagree, downstream development picks one and silently breaks the other.

The three new chips also have undefined visual states (no token mapping, no breakpoint behavior, no a11y labels, no focus order, no reduced-motion behavior) — none of which DESIGN-BRIEF covers because DESIGN-BRIEF never knew these chips existed.

## What needs to change

Pick one of two paths and apply consistently:

**Option A — drop the three "drift assessed:" chips from ARCHITECTURE.md.** Use the architecture document for system contracts only and let DESIGN-BRIEF own user-visible signals. The "what the user sees" sub-bullets in §4.4.1–§4.4.3 should reference the assessment record (§4.6) and feedback item (for `surface-as-feedback`) as the durable surfaces — no new chip vocabulary in the architecture spec. The "manual change pending" chip from DESIGN-BRIEF lifecycles correctly: it appears on replacement, clears when the assessor publishes its disposition, and the disposition is then visible via the assessment record / feedback list.

**Option B — keep the chips in ARCHITECTURE but file a sibling DESIGN-BRIEF amendment** that specs all three (`drift assessed: ignored`, `drift assessed: folded in`, `drift assessed: feedback opened`) with: token mapping (color, background, border), all interaction states (default / hover / focus / active / disabled / loading / error / empty), responsive behavior at 375 / 768 / 1280, accessibility (aria-label, color-not-the-only-signal, screen-reader copy), and clearance rules. Without this, the chips are unimplementable.

Option A is the lower-friction path because the assessment record and feedback list already cover the durable disposition surfaces and DESIGN-BRIEF's existing lifecycle works.

## File / location

`.haiku/intents/out-of-band-human-file-modifications/stages/design/artifacts/ARCHITECTURE.md` §4.4.1, §4.4.2, §4.4.3 — "What the user sees" paragraphs.

---

**Rejection reason:** stale — already fixed by commit 66d6a881 on this fix branch. ARCHITECTURE.md §4.4.1-4.4.3 no longer contain "drift assessed: ignored / folded in / feedback opened" chip vocabulary; the "What the user sees" paragraphs now reference the assessment record (§4.6) and feedback list as the durable surfaces and explicitly honor DESIGN-BRIEF's existing "manual change pending" chip lifecycle (Option A from the finding). Verified: `grep -n "drift assessed" ARCHITECTURE.md` returns zero matches.
