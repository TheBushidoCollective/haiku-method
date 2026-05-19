# Review Stage — Execution

## Per-unit baton (`editor → subject-matter-expert → verifier`)

Every review unit walks three hats in order. The baton is the unit's body as it accumulates editorial and depth findings:

1. **`editor` (plan / do):** Reads the verified draft, applies editorial passes (clarity, voice, terminology consistency, ambiguity, cross-reference resolution, formatting) without altering technical meaning, and surfaces findings that need a non-editorial fix. Hands off when the document is editorially clean and findings are anchored to specific lines.
2. **`subject-matter-expert` (do / depth):** Validates the mental model the draft conveys, flags misleading simplifications, surfaces missing edge cases and failure modes, and compares intended behavior to shipped behavior. Files a structured finding list with severity and responsible hat per finding.
3. **`verifier` (verify):** Validates the unit body itself against the review-stage criteria — preconditions, action, post-condition check, rollback notes where applicable, decision-register consistency. Advances on pass; rejects to the responsible hat when the body fails.

The hat order is `plan → do → verify` because the editor's pass scopes the surface, the SME's pass adds depth, and the verifier validates the unit-of-review artifact.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `completeness` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `completeness` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → editor → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `editor` is the implementer (revises — routing cross-stage to the writer when the finding is technical); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The user signs off on the review pass before content moves to publish.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Silently dropped audit gaps** are the highest-priority finding. The document looks complete but the audit's prioritized list isn't honored.
- **Misleading mental models** beat outright errors for damage — readers act confidently on the wrong intuition.
- **Missing edge cases** for procedures the audience actually runs in production show up as incidents and support tickets later.
- **Stylistic changes that altered technical meaning** are editorial regressions; the editor's job is to preserve meaning while improving clarity.
- **Findings routed to the wrong hat** clog the fix loop. Editorial findings go to editor; technical findings cross-route to writer; structural findings cross-route to architect.
