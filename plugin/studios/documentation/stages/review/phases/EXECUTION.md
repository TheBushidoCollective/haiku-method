# Review Stage — Execution

## Per-unit baton (`editor → subject-matter-expert → verifier`)

Every review unit walks three hats in order. The baton is the unit's body as it accumulates editorial and depth findings:

1. **`editor` (plan / do):** Reads the verified draft, applies editorial passes (clarity, voice, terminology consistency, ambiguity, cross-reference resolution, formatting) without altering technical meaning, and surfaces findings that need a non-editorial fix. Hands off when the document is editorially clean and findings are anchored to specific lines.
2. **`subject-matter-expert` (do / depth):** Validates the mental model the draft conveys, flags misleading simplifications, surfaces missing edge cases and failure modes, and compares intended behavior to shipped behavior. Files a structured finding list with severity and responsible hat per finding.
3. **`verifier` (verify):** Validates the unit body itself against the review-stage criteria — preconditions, action, post-condition check, rollback notes where applicable, decision-register consistency. Advances on pass; rejects to the responsible hat when the body fails.

The hat order is `plan → do → verify` because the editor's pass scopes the surface, the SME's pass adds depth, and the verifier validates the unit-of-review artifact.

## After execute completes

When every review unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. Confirms the review report conforms to the intent's spec.
2. **Quality review (parallel)** — The stage's `completeness` review agent and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, editor, feedback-assessor]` dispatches per finding. The classifier targets the FB; the editor revises (routing cross-stage to the writer when the finding is technical); the assessor decides closure.
4. **Gate** — The stage's gate is `ask`. The user signs off on the review pass before content moves to publish.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Silently dropped audit gaps** are the highest-priority finding. The document looks complete but the audit's prioritized list isn't honored.
- **Misleading mental models** beat outright errors for damage — readers act confidently on the wrong intuition.
- **Missing edge cases** for procedures the audience actually runs in production show up as incidents and support tickets later.
- **Stylistic changes that altered technical meaning** are editorial regressions; the editor's job is to preserve meaning while improving clarity.
- **Findings routed to the wrong hat** clog the fix loop. Editorial findings go to editor; technical findings cross-route to writer; structural findings cross-route to architect.
