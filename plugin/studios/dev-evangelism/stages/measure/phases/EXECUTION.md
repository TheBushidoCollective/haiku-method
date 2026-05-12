# Measure Stage — Execution

## Per-unit baton (`analyst → feedback-synthesizer → verifier`)

Every measure unit walks the three hats in order. Units here are measurement surfaces — one per channel cluster or per audience segment, depending on the intent's reporting structure.

1. **`analyst` (plan / do for the quantitative side):** Reads the intent's declared targets, `DISTRIBUTION-LOG.md`, and the live analytics per channel. Builds the actuals-vs-targets table — every outcome with target, actual, delta, and variance driver named with cited evidence. Keeps reach (impressions), engagement (replies, click-throughs, dwell), and outcome (signups, adoption signals, follow-up conversations) distinct. Marks missing instrumentation `(missing instrumentation)` and queues the corrective action rather than fabricating numbers.
2. **`feedback-synthesizer` (do for the qualitative side):** Reads the community-manager's response log, direct-channel feedback, and the analyst's pattern findings. Captures verbatim quotes first, groups into themes second. Each theme has 2+ representative quotes with source attribution, a dominant sentiment slice, segment attribution, and a "what the team should hear" action. Misunderstandings (audience read X, content meant Y) are surfaced separately with corrective actions for the next intent. Single voices are labeled as single voices, not promoted to patterns.
3. **`verifier` (verify):** Reads the unit body, the analyst's tables, and the synthesizer's themes. Validates that every metric is sourced, every variance has a driver, every theme has quotes, every recommendation is prioritized. Advances or rejects to the responsible hat. Body-only.

The baton is the impact analysis evolving on disk: distribution log + live analytics (inputs) → quantitative table with drivers (analyst) → qualitative themes with quotes and follow-up seeds (feedback-synthesizer) → validated impact report (verifier).

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate against the intent's spec.
2. **Quality review (parallel)** — The stage's `roi` review agent fires (plus any studio-level review agents).
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, analyst, feedback-assessor]` dispatches against each open feedback. The classifier routes; `analyst` is the implementer; the assessor decides closure.
4. **Gate** — The stage's gate is `auto`. Measure is the last stage, and the intent-completion review (if enabled) is the human-facing checkpoint, so the stage advances on its own once the verifier confirms the report is data-grounded.

## Reviewer guidance specific to this stage

- **Vanity metrics presented as outcome** is the highest-frequency finding — reach is not engagement, engagement is not outcome
- **Fabricated numbers** to fill missing-instrumentation cells corrupt the entire report; `(missing instrumentation)` is the correct value
- **Themes with no verbatim quotes** are paraphrase-only summaries that hide what the audience actually said
- **Causation where only correlation exists** is the failure mode that produces wrong follow-up bets; push back hard
- **Unprioritized recommendation lists** leave the team guessing what matters; every recommendation gets a projected impact + effort + connection-to-finding
- **Single loud critic promoted to a theme** invents patterns that don't exist; label single voices accurately
