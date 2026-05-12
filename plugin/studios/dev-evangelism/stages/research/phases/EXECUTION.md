# Research Stage — Execution

## Per-unit baton (`audience-analyst → topic-scout → verifier`)

Every research unit walks the three hats in order. Units here are knowledge topics — one investigable audience-and-topic question per unit, not an execution spec.

1. **`audience-analyst` (plan):** Reads the intent's stated audience hypothesis, prior content history, and available community signals. Produces the segment map for this unit's slice of the audience — segments defined by behavior + technology context (never job title alone), with channel categories, formats, build-vs-evaluate posture, and team-credibility cross-check.
2. **`topic-scout` (do):** Reads the segment map. Scans by channel category for trending threads, underserved gaps, and saturation; cross-checks against team credibility; builds a ranked topic landscape with demand signal, competitive snapshot, timeliness, and recommended formats per topic. Rejection candidates are listed with the failing test named.
3. **`verifier` (verify):** Reads the unit body and the intent-scope `AUDIENCE-LANDSCAPE.md` slice it produced. Validates substance / citation / consistency rules and either advances or rejects to the responsible hat. Body-only; FM is engine territory.

The baton is the audience-and-topic understanding accumulating on disk: hypothesis (intent) → segment map (audience-analyst) → ranked topics tied to segments (topic-scout) → validated knowledge artifact (verifier).

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the research artifacts conform.
2. **Quality review (parallel)** — The stage's `relevance` review agent fires (plus any studio-level review agents). Findings get filed as feedback.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, audience-analyst, feedback-assessor]` dispatches against each open feedback. The classifier routes; `audience-analyst` is the implementer; the assessor independently decides closure.
4. **Gate** — The stage's gate is `auto`. Research is upstream of any creative or production decisions, so the workflow advances without a human gate once review is clean.

## Reviewer guidance specific to this stage

- **Audience segmented by job title only** is the single most common finding here — push the hat to ground every segment in behavior + technology context with a cited signal source
- **Topics with no segment match** are scope creep, not opportunity — they get filed back rather than allowed through
- **Demand signals stated without dates or volume** are unsupported; "trending" needs an evidence window
- **Credibility gaps listed silently** become weak content later in the lifecycle; surface them explicitly
