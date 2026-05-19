# Draft Stage — Execution

## Per-unit baton (`writer → technical-reviewer`)

Every draft unit walks the two hats in order. The baton is the unit's body as content accumulates:

1. **`writer` (plan / do):** Reads the assigned outline section and its declared Diátaxis mode, drafts prose plus examples, verifies every technical claim against the source of truth as they write, labels version-specific behavior, defines jargon on first use, and honors accessibility basics (heading hierarchy, alt text, code language tags). Hands off when the section delivers on its purpose statement, every claim is verifiable, every example has been run, and no placeholders remain.
2. **`technical-reviewer` (verify):** Tests every code example, validates API signatures and shapes against source, checks configuration values, walks every procedure from the documented prerequisites, and either advances or rejects with the specific failed claim and the responsible hat named.

The hat order is `plan/do → verify` because the writer's output IS the deliverable; the technical-reviewer verifies it rather than rewriting it.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → writer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `writer` is the implementer (revises prose); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The user signs off on draft completeness before editorial review begins. Project overlays may add platform-specific conventions (the project's docs platform, voice guide, style enforcement).

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Code examples that don't run** are the highest-priority finding. They become reader bug reports and erode trust in the entire corpus.
- **API drift** — signatures, defaults, error responses that no longer match source — is the second-most-damaging finding, and the hardest for a reader to recover from.
- **Mode mixing** (a tutorial that becomes reference, a reference that lectures) fails readers regardless of accuracy and is hard to fix incrementally.
- **Procedures with missing prerequisites** look correct until a real reader runs them; they hit a wall and bounce.
- **Jargon used before definition** is a clarity failure that compounds across sections — readers who give up on a term give up on the document.
