# Prototype Stage — Execution

## Per-unit baton (`prototype-engineer → game-designer → playtester → verifier`)

Every prototype unit walks the four hats in order. The baton is the runnable slice plus the unit body's accumulating sections:

1. **`prototype-engineer` (plan + do):** Reads concept's core-loop spec, pillars, and fantasy. Builds the smallest playable thing that exercises the unit's piece of the core loop, with deliberate shortcuts on everything *except* the mechanic being tested. Instruments the slice with session and decision logging. Appends `## Prototype Build Log` naming what was built, what's stubbed, and where instrumentation lands. Hands off the slice plus the build log.
2. **`game-designer` (do-refine):** Watches playtests live (or on recording) and reads instrumented data. Diagnoses where the loop isn't landing — at the loop level, not by adding content. Iterates: signal → hypothesis → change → re-test. Appends `## Design Iteration` entries until iteration converges on a verdict (fun confirmed / fun unconfirmed — concept revision / fun unconfirmed — recommend kill).
3. **`playtester` (do-validate):** Runs the formal playtest sessions with non-team players whose profile matches concept's audience. Captures behavior (what they did), affect (visible signals), comments (verbatim quotes), and instrumentation snapshots. Appends `## Playtest Record` with numbered session entries and a per-pillar verdict table.
4. **`verifier` (verify):** Validates the unit body — playtest sessions exist, sample size is sufficient, per-pillar verdicts cite evidence, design iteration record names a final verdict. Either advances or rejects with the responsible hat named.

The hat order is `plan-do → do-refine → do-validate → verify` because the slice must exist before iteration begins, iteration must converge before formal sessions certify the verdict, and certification is what the verifier validates.

## After execute completes

When every prototype unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. Built-in spec-conformance subagent reads the intent's spec and confirms the prototype artifacts conform.
2. **Quality review (parallel)** — The stage's review agents (`fun-validation`, `loop-integrity`) fire in parallel.
3. **Fix loop (if any feedback opens)** — The `fix_hats:` chain (`classifier → prototype-engineer → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB; `prototype-engineer` re-cuts the slice where the finding lands; the assessor decides closure.
4. **Gate** — The stage's gate is `[external, ask]` — the user picks between submitting the playable build to an external review (e.g., a publisher milestone, an investor demo, a marketing greenlight) or approving locally inside the review UI.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Fun verdict supported by team opinion rather than non-team player behavior** is the dominant failure mode. The fun-validation lens enforces this specifically — sessions with only team members do not count as fun validation.
- **Slice that skipped a loop element** under build-time pressure is the second-most-common failure — the prototype validates the loop in concept, not a simplified variant.
- **"It'll be fun once we add X"** is a NO verdict in disguise; the prototype either validated fun or it didn't.
- **A pillar from concept that the per-pillar verdict table doesn't address** is a pillar the prototype didn't test — silence reads as forgotten.
