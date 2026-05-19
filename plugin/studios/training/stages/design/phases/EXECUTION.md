# Design Stage — Execution

## Per-unit baton (`designer → subject-expert → verifier`)

Every design unit walks the three hats in order. The baton is the unit's `CURRICULUM-PLAN.md` accumulating from structure, to validated content, to verified artifact:

1. **`designer` (plan):** Re-reads the needs assessment for this unit. Groups learning objectives into modules by prerequisite relationship, cognitive level, and practical clustering. Chooses an instructional strategy per module matched to the Bloom level of its objectives. Designs both formative and summative assessment per module with passing standards and objective traces. Decides linear vs. adaptive sequencing with audience-driven justification. States the timing envelope with the modality assumption. Hands off when every objective has a module, every module has a strategy and assessment, and every prereq is reflected in sequencing.

2. **`subject-expert` (do):** Reads the curriculum plan critically. Flags inaccurate, outdated, or mis-leveled content. Audits for missing topics (failure modes, edge cases, unwritten rules). Supplies real-practice worked examples, practice scenarios, and anti-examples per module. Validates audience-fit of language and assumed prior knowledge. Flags transfer-to-job risks where the design won't survive contact with the audience's working reality. Hands off when the design's content claims are accurate, the examples are real, and the audience fit is sound.

3. **`verifier` (verify):** Reads the unit body. Validates substance (concrete design, not outline), traceability (every design choice cites the upstream input it rests on), internal coherence (no contradictions between sub-components), decision-register consistency, and open-question accountability. Either advances or rejects to the responsible hat.

The hat order is `plan → do → verify` because the designer's structure is the spec the subject-expert validates and enriches, and the enriched design is what the verifier signs off.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → designer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `designer` is the implementer (re-authors the work); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The user approves the curriculum design locally before the develop stage builds materials against it.

## Reviewer guidance specific to this stage

- **An objective covered by a module but missing from the assessment plan** (or vice versa) is the highest-priority finding. Coverage gaps here propagate through every material asset and every evaluation question.
- **A strategy-Bloom mismatch** (e.g., lecture for an `apply` objective) is the second-highest — the materials produced against this strategy will be structurally insufficient for the cognitive demand no matter how polished they are.
- **A linear sequence where the audience profile calls for branching** (or branching imposed without justification) is a design finding — branching multiplies build cost and operational complexity, so the justification matters.
- **A summative assessment whose format can't credibly verify the targeted Bloom level** is a measurement finding — multiple-choice cannot meaningfully assess `create`; scenario response without a rubric cannot be scored consistently.
