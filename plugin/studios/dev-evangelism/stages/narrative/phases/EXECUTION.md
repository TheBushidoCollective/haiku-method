# Narrative Stage — Execution

## Per-unit baton (`storyteller → editor → verifier`)

Every narrative unit walks the three hats in order. Units here are story components — the hook, the central conflict, the resolution, per-segment messaging — not assets and not execution specs.

1. **`storyteller` (plan / do for the arc):** Reads the research stage's `AUDIENCE-LANDSCAPE.md` and the intent's stated outcome. Chooses an arc shape (problem-solution-outcome, discovery-reframe-implication, walkthrough-insight-next-step, or comparison-tradeoff-recommendation) and drafts the arc — hook, beats, at-most-3 takeaways, audience-to-message mapping, and `(needs demo)` flags on every claim that requires runnable proof.
2. **`editor` (do for clarity / fit):** Reads the drafted arc. Refines tone to match the segments' vocabulary, strips marketing language, sharpens takeaways into concrete actions, audits claims, enforces the demo flag, and captures format-specific adaptations where the default arc breaks for a planned format (talk vs. long-form vs. video, etc.). Structural problems route back to the storyteller via rejection rather than being rewritten in-place.
3. **`verifier` (verify):** Reads the unit body and the intent-scope `NARRATIVE-BRIEF.md` slice. Validates substance / citation / consistency rules and either advances or rejects to the responsible hat. Body-only.

The baton is the story evolving on disk: audience landscape (input) → drafted arc with flagged claims (storyteller) → polished, audience-fit, format-tested arc (editor) → validated narrative artifact (verifier).

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate against the intent's spec.
2. **Quality review (parallel)** — The stage's `coherence` review agent fires (plus any studio-level review agents).
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, storyteller, feedback-assessor]` dispatches against each open feedback. The classifier routes; `storyteller` is the implementer; the assessor decides closure.
4. **Gate** — The stage's gate is `ask`. The narrative brief is the last load-bearing decision before content production starts, so a human reviews the arc and takeaways before the create stage spins up.

## Reviewer guidance specific to this stage

- **Hook opens on team capability** is the most common finding — push it back to land on audience experience
- **Takeaway count above 3** dilutes everything that follows; capped is non-negotiable
- **Unflagged claims requiring runnable proof** are the gap that breaks the create stage; the demo-builder cannot build what it cannot see
- **Segments from the audience landscape silently dropped** from the mapping are findings; explicit "out-of-scope because X" is the contract
- **Marketing language survival** (`revolutionary`, `game-changing`, `world-class`) means the editor pass missed; route back, don't approve through
