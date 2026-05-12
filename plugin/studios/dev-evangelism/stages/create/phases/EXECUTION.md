# Create Stage — Execution

## Per-unit baton (`content-creator → demo-builder → verifier`)

Every create unit walks the three hats in order. Units here are asset families — one blog post, one talk, one demo project, one video — each with its prose / slides / script asset AND any runnable demo the asset depends on.

1. **`content-creator` (plan / do for the asset):** Reads the unit's slice of `NARRATIVE-BRIEF.md`. Picks the format-specific shape (long-form, short-form, talk + notes, video script, podcast outline, live-coding plan, workshop). Drafts the asset — hook in the open, every section earning the next, takeaways made explicit, calls-to-action specific, every flagged claim referencing the demo-builder's proof. No placeholder, no marketing language, no lorem ipsum at handoff.
2. **`demo-builder` (do for runnable proof):** Reads the brief's flagged claims and the content-creator's in-progress asset. Picks the demo shape (snippet, runnable repo, benchmark script, sandbox, workshop track, live-coding plan). Builds to the reproducibility bar — clean-environment cloneable, pinned dependencies, no hardcoded secrets, documented setup time budget, smoke check, README. Cross-references with the asset to confirm what the asset claims matches what the demo shows.
3. **`verifier` (verify):** Reads the unit body, the asset, and the demo. Validates substance / runnability / consistency rules and either advances or rejects to the responsible hat. Body-only.

The baton is the asset-demo pair evolving on disk: narrative brief (input) → drafted asset with claim references (content-creator) → asset + matching runnable demo (demo-builder) → validated asset pair (verifier).

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate against the intent's spec.
2. **Quality review (parallel)** — The stage's `engagement` and `technical-accuracy` review agents fire in parallel (plus any studio-level review agents).
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, content-creator, feedback-assessor]` dispatches against each open feedback. The classifier routes; `content-creator` is the implementer (re-authoring the asset where the finding belongs; demo issues route to a follow-up unit because completed units are forward-only per architecture §1.3); the assessor decides closure.
4. **Gate** — The stage's gate is `ask`. Content correctness and tone are the highest-stakes decision before public distribution; a human reviews before publish kicks off.

## Reviewer guidance specific to this stage

- **Asset and demo diverge** is the highest-priority finding — the asset claims X, the demo shows X', and any attentive reader catches it and loses trust
- **Code that won't compile** is a hard fail — the create stage's promise is "copy-paste-and-run"
- **Unpinned dependencies in demos** rot quietly; every dependency pinned, no `latest`
- **Format-specific shape violations** (talk decks with text walls, video scripts as essays, long-form without structure) reduce reach; route back to the content-creator
- **Marketing language survival** that the editor should have caught (`revolutionary`, `world-class`, etc.) means the lifecycle has drift; surface it as feedback against the narrative stage if it keeps surviving review here
