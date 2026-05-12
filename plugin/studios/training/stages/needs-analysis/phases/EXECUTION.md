# Needs Analysis Stage — Execution

## Per-unit baton (`analyst → consultant → verifier`)

Every needs-analysis unit walks the three hats in order. The baton across the rally race is the unit's `NEEDS-ASSESSMENT.md` body accumulating evidence, then interpretation, then validation:

1. **`analyst` (plan):** Establishes the target performance from role definition, strategic context, and subject-matter input. Gathers current-state evidence from performance data, direct assessment, structured stakeholder input, or system telemetry. Quantifies the gap per target behavior, classifies each gap as knowledge / skill / will, and prioritizes by `business impact × learning feasibility`. Hands off when every priority gap is evidence-backed and classified.

2. **`consultant` (do):** Reads the analyst's evidence and gap classification. Confirms whether training is the right intervention (and recommends a non-training alternative if it isn't). Assesses organizational readiness. Recommends modality (synchronous / asynchronous, in-person / remote, self-paced / cohort) with justification anchored to the audience. Writes the learning objectives using Bloom-aligned action verbs, with every objective tracing to a specific gap. Hands off when the trace from gap → intervention → objective holds.

3. **`verifier` (verify):** Reads the unit body. Validates substance (no placeholders, no TODO markers), citation (every numerical or stakeholder claim has a named source), and internal consistency (the recommendation follows from the evidence). Either advances (`haiku_unit_advance_hat`) or rejects to the responsible hat with a named failed criterion.

The hat order is `plan → do → verify` because the analyst's evidence is the spec the consultant interprets, and the interpretation is what the verifier validates.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent reads the intent's spec and confirms the needs assessment conforms.
2. **Quality review (parallel)** — The `validity` review agent fires alongside any studio-level review agents. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The `fix_hats: [classifier, analyst, feedback-assessor]` chain dispatches per finding. The classifier routes the FB; the analyst re-grounds the evidence where the finding lands; the assessor independently decides closure.
4. **Gate** — Gate is `auto`. The workflow engine advances to the design stage once review agents sign off.

## Reviewer guidance specific to this stage

- **A gap without evidence is the highest-priority finding.** Everything downstream rests on the gap analysis; a soft gap analysis produces a soft program no matter how good the later stages are.
- **A will / system gap with a training recommendation attached anyway** is the second-highest. Training delivered into a hostile system produces near-zero transfer to job.
- **A learning objective that names a topic instead of a behavior** is a structural finding — the design stage cannot execute against `understand authentication`; it can execute against `configure OAuth2 for a public API given a service definition and access-control requirements`.
- **A modality choice without audience justification** is a process finding — the team's habits aren't the audience.
