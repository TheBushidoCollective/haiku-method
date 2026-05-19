# Production Stage — Execution

## Per-unit baton (`gameplay-engineer → systems-designer → content-author → reviewer`)

Every production unit walks the four hats in order. The baton is the unit body, accumulating each hat's deliverable section:

1. **`gameplay-engineer` (plan + do-foundation):** Reads concept doc, prototype artifact, and the unit's success criteria. Reimplements the validated core loop at production quality — maintainable, testable, with named tuning surfaces and authoring affordances. Appends `## Production Systems Log` covering systems built, affordances exposed, test coverage applied. Does NOT copy prototype code; builds fresh against the prototype's *design*.
2. **`systems-designer` (do-tuning):** Reads the production systems' tuning surfaces. Tunes the interlocking systems at the math layer — economies, progression, difficulty, meta-systems — grounding every curve in playtest evidence rather than intuition. Appends `## Systems Tuning Log` with per-system pillar mapping, current curve, and evidence.
3. **`content-author` (do-content):** Reads the tuned systems and the concept's pillar / fantasy / scope envelope. Builds player-experienced content (levels, encounters, narrative beats, audio cues) against the systems and tuning curves, with pillar mapping for every piece. Refuses content that requires a system the game doesn't have. Appends `## Content Manifest` and `## Tonal References`.
4. **`reviewer` (verify):** Reads the unit body end-to-end. Walks pillar adherence (every system / curve / content piece maps to a pillar) and scope discipline (no work exceeds the validated prototype's scope) and test-and-evidence (every claim has evidence). Either advances or rejects with the responsible hat named.

The hat order is `plan + do-foundation → do-tuning → do-content → verify` because the foundation must exist before tuning is possible, tuning must be in place before content authoring is constrained by curves, and content must be assembled before pillar adherence and scope discipline can be evaluated as a whole.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `pillar-alignment` and `scope-discipline` review agents and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `pillar-alignment` and `scope-discipline` review agents and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → gameplay-engineer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `gameplay-engineer` is the implementer (re-cutting the system or fixing the content's underlying scaffolding); the assessor independently decides closure.

6. **Gate** — The stage's gate is `[external, ask]`. The user picks between external review (e.g., a publisher milestone review at alpha or beta) or local approval.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Scope creep dressed as "while we're at it"** is the dominant production-stage failure. Scope-discipline lens enforces this regardless of whether the added work is good — merit isn't the gate.
- **Pillar drift in content authored by different hands** is the second-most-common failure — different authors interpret pillars differently and the build feels mixed.
- **Tuning curves that contradict the pillar they claim to serve** are easy to miss in code review and obvious in playtest data.
- **Engineering bottlenecks for routine authoring** signal the gameplay-engineer didn't expose the right affordances; surface as findings against the gameplay-engineer hat, not against the content-author who couldn't ship without engineering round-trips.
