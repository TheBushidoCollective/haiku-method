---
title: Defer establish-mode chip styling — remove SPA-UI-SPECS.md cross-reference
model: haiku
closes:
  - FB-03
  - FB-13
inputs:
  - stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md
  - >-
    stages/design/feedback/03-rollout-and-baseline-establishment-md-references-spa-ui-spec.md
  - >-
    stages/design/feedback/13-fb-03-fix-loop-exhausted-assessor-disagreed-with-designer-s.md
outputs:
  - stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md
status: completed
bolt: 1
hat: feedback-assessor
started_at: '2026-04-28T21:40:06Z'
hat_started_at: '2026-04-28T21:43:02Z'
iterations:
  - hat: designer
    started_at: '2026-04-28T21:40:06Z'
    completed_at: '2026-04-28T21:41:01Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-28T21:41:01Z'
    completed_at: '2026-04-28T21:43:02Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-28T21:43:02Z'
    completed_at: '2026-04-28T21:55:30Z'
    result: advance
completed_at: '2026-04-28T21:55:30Z'
---
# Defer establish-mode chip styling — remove SPA-UI-SPECS.md cross-reference

Edit `stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md` to remove the cross-artifact reference to SPA-UI-SPECS.md in the §4 establish-mode chip discussion and replace it with the explicit deferral wording from FB-03's recommended resolution option 3. The fix-loop hats spent 3 bolts on alternative phrasings (inline description, path + anchor); the assessor rejected each one and bolt 3 stalled. The deferral path is the only fix that's structurally simple — it avoids token-naming choices, byte-budget mismatches, ARIA contracts, and contrast tables that pre-execute review flagged as gaps in the inline-description alternative.

This unit closes FB-03 (the cross-reference complaint) and FB-13 (the meta-finding that the fix loop couldn't resolve FB-03 in 3 bolts).

## Scope

Apply ONLY the **explicit deferral path** to ROLLOUT-AND-BASELINE-ESTABLISHMENT.md §4 (whichever subsection currently references SPA-UI-SPECS.md):

Replace the SPA-UI-SPECS.md reference with this exact wording (or a near-equivalent that preserves the three load-bearing pieces — *deferral*, *neutral container until then*, *no interactive affordance*):

> "Chip styling for the establish-mode indicator is intentionally deferred to the development stage's design-system pass; the indicator is a text label in a neutral container with no interactive affordance until then. ARIA semantics and contrast tokens are determined when the chip is implemented, alongside the rest of the SPA's status-chip family."

The deferral wording is chosen deliberately over an inline visual description because:
- DESIGN-TOKENS.md §1.3.3 defines only `*-fg` tokens for the baseline-stale state, not `*-bg` — the chip's container background has no canonical token, and inventing one belongs in development
- The existing stage-card status chips (`StageProgressStrip`) currently use raw Tailwind palette classes, so "match the existing chips" would propagate raw-palette usage to a new semantic surface
- ARIA semantics, contrast ratios, and touch-target sizing for a passive informational chip belong with the surrounding status-chip family work in development, not as a one-off paragraph in a rollout document

The rest of ROLLOUT-AND-BASELINE-ESTABLISHMENT.md is unchanged.

## Completion Criteria

- ROLLOUT-AND-BASELINE-ESTABLISHMENT.md no longer contains the substring `SPA-UI-SPECS.md` anywhere — verifiable by `! grep -n 'SPA-UI-SPECS\.md' stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md` returning exit 0
- The replacement text contains all three load-bearing phrases verbatim or near-verbatim: "intentionally deferred", "neutral container", and "no interactive affordance" — verifiable by `grep` for each phrase
- The replacement explicitly defers ARIA and contrast decisions to development — the words "ARIA" and "contrast" appear in the new paragraph
- ROLLOUT-AND-BASELINE-ESTABLISHMENT.md does NOT introduce a new cross-reference to any other design artifact (DESIGN-BRIEF.md, DESIGN-TOKENS.md, ARCHITECTURE.md, TRACKED-SURFACE-BOUNDARY.md, or SPA-UI-SPECS.md) — verifiable by `! grep -nE '(DESIGN-BRIEF|DESIGN-TOKENS|ARCHITECTURE|TRACKED-SURFACE-BOUNDARY|SPA-UI-SPECS)\.md' stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md` returning exit 0 (cross-references that already existed pre-FB-03 are excluded — only the §4 chip-discussion paragraph is in scope)
- Document length is within ±200 bytes of the prior version
- The document's overall structure (sections, headings, ordering) is unchanged outside the affected paragraph
- FB-03 and FB-13 are closed by the feedback-assessor in the fix-loop chain (handled by the framework via the `closes:` frontmatter on this unit)
