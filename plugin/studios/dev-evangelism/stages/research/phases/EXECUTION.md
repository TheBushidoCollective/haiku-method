# Research Stage — Execution

## Per-unit baton (`audience-analyst → topic-scout → verifier`)

Every research unit walks the three hats in order. Units here are knowledge topics — one investigable audience-and-topic question per unit, not an execution spec.

1. **`audience-analyst` (plan):** Reads the intent's stated audience hypothesis, prior content history, and available community signals. Produces the segment map for this unit's slice of the audience — segments defined by behavior + technology context (never job title alone), with channel categories, formats, build-vs-evaluate posture, and team-credibility cross-check.
2. **`topic-scout` (do):** Reads the segment map. Scans by channel category for trending threads, underserved gaps, and saturation; cross-checks against team credibility; builds a ranked topic landscape with demand signal, competitive snapshot, timeliness, and recommended formats per topic. Rejection candidates are listed with the failing test named.
3. **`verifier` (verify):** Reads the unit body and the intent-scope `AUDIENCE-LANDSCAPE.md` slice it produced. Validates substance / citation / consistency rules and either advances or rejects to the responsible hat. Body-only; FM is engine territory.

The baton is the audience-and-topic understanding accumulating on disk: hypothesis (intent) → segment map (audience-analyst) → ranked topics tied to segments (topic-scout) → validated knowledge artifact (verifier).

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `relevance` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `relevance` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → audience-analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `audience-analyst` is the implementer (re-authors the work); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Research is upstream of any creative or production decisions, so the workflow advances without a human gate once review is clean.

## Reviewer guidance specific to this stage

- **Audience segmented by job title only** is the single most common finding here — push the hat to ground every segment in behavior + technology context with a cited signal source
- **Topics with no segment match** are scope creep, not opportunity — they get filed back rather than allowed through
- **Demand signals stated without dates or volume** are unsupported; "trending" needs an evidence window
- **Credibility gaps listed silently** become weak content later in the lifecycle; surface them explicitly
