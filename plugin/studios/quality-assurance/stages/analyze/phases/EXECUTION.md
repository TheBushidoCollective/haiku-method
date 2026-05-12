# Analyze Stage — Execution

## Per-unit baton (`analyst → statistician → verifier`)

Every analyze unit walks the three hats in order. The baton is the unit body accumulating from pattern-hypotheses to rigorously-validated-findings to validated artifact:

1. **`analyst` (plan / do for findings):** Reads the test results, the strategy, and any baseline. Computes descriptive metrics. Walks the pattern lenses (code area, boundary, data class, environment, state, regression-vs-new). Categorizes defects by root-cause. Names trend candidates. Writes findings as FINDING + EVIDENCE + SO WHAT + RECOMMENDATION + PRIORITY. Hands off when patterns are surfaced and recommendations are actionable.
2. **`statistician` (do for rigor):** Validates metric math, assesses sample-size sufficiency per claim, checks baseline comparability, applies effect-size-vs-noise reasoning to trend claims, surfaces distribution skew the analyst's averages may have hidden. Hands off when every claim has a rigor assessment.
3. **`verifier` (verify):** Validates substance, citation, internal consistency, decision-register consistency. Advances or rejects to the responsible hat. Does not edit the unit.

The hat order is `plan → do → verify` because pattern-hunt is the plan / do, rigor is the do continuation, validation is the verify.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — `insight` review agent fires; surfaces descriptive-only metrics, pattern-walk gaps, unrigorous trend claims, vague recommendations, and hidden distributions.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, analyst, feedback-assessor]` dispatches per FB. The classifier routes; `analyst` re-does analysis where the finding lives; the assessor decides closure.
4. **Gate** — `ask`. A human reviews the analysis locally — the release / defer / block recommendation is a judgment call and the human gate is load-bearing.

## Reviewer guidance specific to this stage

- **"Numbers without interpretation" is the highest-priority finding.** A report that lists pass rates and severity counts but doesn't say what they mean is data, not analysis.
- **Pattern-walk shallowness** is the next priority — only walking "by area" misses boundary, data-class, environment, and state-transition clusters that drive recurring quality issues.
- **Unrigorous trend claims** propagate into certification as overconfident judgments — flag and qualify here.
- **Recommendations without priority** force `certify` to invent the tiering.
