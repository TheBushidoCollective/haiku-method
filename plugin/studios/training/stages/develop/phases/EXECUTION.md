# Develop Stage — Execution

## Per-unit baton (`developer → editor → verifier`)

Every develop unit walks the three hats in order. The baton is `TRAINING-MATERIALS.md` (an index) plus the produced assets accumulating in the project's authoring environment:

1. **`developer` (plan / do):** Reads the curriculum plan and the subject-expert hat's real-practice material. Builds the facilitator guide (purpose, time envelope, materials needed, run-of-show, talking points, anticipated questions, adaptation guidance, practice instructions, debrief prompts). Builds participant materials mirroring the facilitator guide. Builds practice activities graduated low-to-high difficulty. Builds assessments matched to the Bloom level of each objective with rubrics. Designs accessibility in from the start. Indexes everything on `TRAINING-MATERIALS.md`. Hands off when every asset declared in the curriculum plan exists.

2. **`editor` (do — quality):** Runs a consistency pass across modules (terminology, formatting, pedagogical patterns, voice, branding). Runs an audience-fit pass on language. Corrects content / grammar / visual errors. Verifies accessibility per asset with named tools / methods. Verifies delivery-format viability in the actual modality. Stays in scope — surfaces structural issues rather than rewriting them. Hands off when the asset set is release-ready.

3. **`verifier` (verify):** Reads the unit body. Validates that the body's acceptance criteria are paired with concrete verify-checks, that those checks confirm each asset exists at its declared location, that the accessibility check passes, and that every objective has a matching assessment with a rubric. Either advances or rejects to the responsible hat.

The hat order is `plan → do → verify` because the developer's output is the spec the editor polishes, and the polished asset set is what the verifier validates.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The `quality` review agent fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — The `fix_hats: [classifier, developer, feedback-assessor]` chain dispatches per finding.
4. **Gate** — Gate is `ask`. The user approves the materials locally before the deliver stage schedules sessions against them.

## Reviewer guidance specific to this stage

- **A facilitator guide and participant materials that contradict each other** is the highest-priority finding. The two are the same content in two formats; if they disagree, in-session contradictions are guaranteed.
- **An accessibility failure** (missing captions, missing alt text, contrast below WCAG AA, screen-reader-broken structure) is a finding that blocks delivery — accommodations cannot be retrofitted mid-cohort.
- **An assessment format that can't credibly verify the targeted Bloom level** is a measurement finding the design stage may have already caught; if it surfaces here, route back via feedback rather than hide it with a polish pass.
- **A missing job aid for an on-the-job application program** is a transfer-to-job finding — the job aid is the single highest-leverage post-program artifact.
- **Materials authored in a modality the design didn't call for** (lecture deck for an async self-paced module, e-learning module for an interactive workshop) is a structural finding — the polish is irrelevant if the modality is wrong.
