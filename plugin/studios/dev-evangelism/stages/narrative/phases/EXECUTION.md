# Narrative Stage — Execution

## Per-unit baton (`storyteller → editor → verifier`)

Every narrative unit walks the three hats in order. Units here are story components — the hook, the central conflict, the resolution, per-segment messaging — not assets and not execution specs.

1. **`storyteller` (plan / do for the arc):** Reads the research stage's `AUDIENCE-LANDSCAPE.md` and the intent's stated outcome. Chooses an arc shape (problem-solution-outcome, discovery-reframe-implication, walkthrough-insight-next-step, or comparison-tradeoff-recommendation) and drafts the arc — hook, beats, at-most-3 takeaways, audience-to-message mapping, and `(needs demo)` flags on every claim that requires runnable proof.
2. **`editor` (do for clarity / fit):** Reads the drafted arc. Refines tone to match the segments' vocabulary, strips marketing language, sharpens takeaways into concrete actions, audits claims, enforces the demo flag, and captures format-specific adaptations where the default arc breaks for a planned format (talk vs. long-form vs. video, etc.). Structural problems route back to the storyteller via rejection rather than being rewritten in-place.
3. **`verifier` (verify):** Reads the unit body and the intent-scope `NARRATIVE-BRIEF.md` slice. Validates substance / citation / consistency rules and either advances or rejects to the responsible hat. Body-only.

The baton is the story evolving on disk: audience landscape (input) → drafted arc with flagged claims (storyteller) → polished, audience-fit, format-tested arc (editor) → validated narrative artifact (verifier).

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coherence` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coherence` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → storyteller → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `storyteller` is the implementer (re-authors the work); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The narrative brief is the last load-bearing decision before content production starts, so a human reviews the arc and takeaways before the create stage spins up.

## Reviewer guidance specific to this stage

- **Hook opens on team capability** is the most common finding — push it back to land on audience experience
- **Takeaway count above 3** dilutes everything that follows; capped is non-negotiable
- **Unflagged claims requiring runnable proof** are the gap that breaks the create stage; the demo-builder cannot build what it cannot see
- **Segments from the audience landscape silently dropped** from the mapping are findings; explicit "out-of-scope because X" is the contract
- **Marketing language survival** (`revolutionary`, `game-changing`, `world-class`) means the editor pass missed; route back, don't approve through
