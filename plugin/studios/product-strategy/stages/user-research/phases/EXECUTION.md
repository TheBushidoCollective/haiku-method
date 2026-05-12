# User Research Stage — Execution

## Per-unit baton (`user-researcher → insights-synthesizer → verifier`)

Every user-research unit walks the three hats in order. The baton across the rally race is the unit body accumulating raw signal and then distilled insight:

1. **`user-researcher` (plan / gather):** Reads the unit's framing (research question, segments, methods, non-goals agreed during elaboration). Designs the inquiry, gathers signal across the chosen methods, and captures verbatim quotes, behavioral observations, and jobs-to-be-done in user language. Records sample, method, response rate for every quantitative claim.
2. **`insights-synthesizer` (do / distill):** Reads the raw findings end-to-end first, then clusters patterns into themes (with both supporting and counter-signals), preserves segment-level differences as named tensions, and writes actionable insights with confidence and caveats.
3. **`verifier` (verify):** Validates the artifact body-only — research questions are answerable, sample is representative, themes have at least three supporting signals plus counter-signals, jobs-to-be-done are in user language. Advances or rejects with a named criterion.

The hat order is `plan → do → verify` because raw findings are the substrate the synthesizer operates on; weak findings produce weak insights, and the verifier checks both.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `methodology` review agent fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, user-researcher, feedback-assessor]` dispatches per finding. The classifier routes the FB; the user-researcher re-gathers or re-frames against the gap; the assessor independently decides closure.
4. **Gate** — `ask`. The user reviews the synthesized insights before prioritization scores against them; misread insights propagate down the entire chain.

## Reviewer guidance specific to this stage

- **Themes without counter-signals** are the highest-priority finding — they signal confirmation bias, and they ship strategy that breaks on the first user who falls outside the pattern.
- **Cross-segment averaging that hides a tension** is next — the prioritization stage needs the tension to make a defensible trade-off, and silent averaging strips that signal out.
- **Jobs-to-be-done written as feature requests** ("users want a faster search") indicate the researcher captured the team's translation, not the user's voice.
- **Single anecdotes elevated to themes** are findings to file; insights need at least three independent supporting signals.
