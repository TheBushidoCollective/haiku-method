# Create Stage — Execution

## Per-unit baton (`content-creator → demo-builder → verifier`)

Every create unit walks the three hats in order. Units here are asset families — one blog post, one talk, one demo project, one video — each with its prose / slides / script asset AND any runnable demo the asset depends on.

1. **`content-creator` (plan / do for the asset):** Reads the unit's slice of `NARRATIVE-BRIEF.md`. Picks the format-specific shape (long-form, short-form, talk + notes, video script, podcast outline, live-coding plan, workshop). Drafts the asset — hook in the open, every section earning the next, takeaways made explicit, calls-to-action specific, every flagged claim referencing the demo-builder's proof. No placeholder, no marketing language, no lorem ipsum at handoff.
2. **`demo-builder` (do for runnable proof):** Reads the brief's flagged claims and the content-creator's in-progress asset. Picks the demo shape (snippet, runnable repo, benchmark script, sandbox, workshop track, live-coding plan). Builds to the reproducibility bar — clean-environment cloneable, pinned dependencies, no hardcoded secrets, documented setup time budget, smoke check, README. Cross-references with the asset to confirm what the asset claims matches what the demo shows.
3. **`verifier` (verify):** Reads the unit body, the asset, and the demo. Validates substance / runnability / consistency rules and either advances or rejects to the responsible hat. Body-only.

The baton is the asset-demo pair evolving on disk: narrative brief (input) → drafted asset with claim references (content-creator) → asset + matching runnable demo (demo-builder) → validated asset pair (verifier).

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → content-creator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `content-creator` is the implementer (re-authoring the asset where the finding belongs; demo issues route to a follow-up unit because completed units are forward-only per architecture §1.3); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Content correctness and tone are the highest-stakes decision before public distribution; a human reviews before publish kicks off.

## Reviewer guidance specific to this stage

- **Asset and demo diverge** is the highest-priority finding — the asset claims X, the demo shows X', and any attentive reader catches it and loses trust
- **Code that won't compile** is a hard fail — the create stage's promise is "copy-paste-and-run"
- **Unpinned dependencies in demos** rot quietly; every dependency pinned, no `latest`
- **Format-specific shape violations** (talk decks with text walls, video scripts as essays, long-form without structure) reduce reach; route back to the content-creator
- **Marketing language survival** that the editor should have caught (`revolutionary`, `world-class`, etc.) means the lifecycle has drift; surface it as feedback against the narrative stage if it keeps surviving review here
