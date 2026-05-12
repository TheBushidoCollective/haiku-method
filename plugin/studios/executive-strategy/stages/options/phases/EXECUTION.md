# Options Stage — Execution

## Per-unit baton (`ideator → modeler → verifier`)

Every options unit walks the three hats in order. The baton is the unit's body — option set first, models second, verification last:

1. **`ideator` (plan):** Reads the landscape analysis and the unit's strategic axis. Generates at least three genuinely distinct options including at least one unconventional alternative. For each option writes name, value proposition, theory of change, strategic stance, and "what this option is NOT". Hands off when the set is differentiated and every option has a stated causal chain.
2. **`modeler` (do):** Reads the ideator's option set. Pins shared assumptions (time horizon, discount rate, market sizing, cost baselines) once, then builds the parallel financial / operational model per option. Includes sensitivity analysis on top drivers and names the killer assumptions per option. Hands off when every option has a model using the same structure and the killer assumptions are surfaced.
3. **`verifier` (verify):** Reads the unit body. Checks substance, traceability to landscape inputs, internal coherence, and decision-register consistency per the body-only mandate. Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because differentiation is a planning decision; building a model around an option that's secretly the same as another option wastes the modeler's work and corrupts the comparison.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate confirming conformance to the intent's spec.
2. **Quality review (parallel)** — The stage's `differentiation` review agent fires alongside any studio-level review agents. Findings file as feedback.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, ideator, feedback-assessor]` dispatches per finding. The classifier routes the FB. `ideator` is the implementer (re-thinking the option set when distinction or theory-of-change is the gap). The assessor independently decides closure.
4. **Gate** — The stage's gate is `ask` — local human approval. The option set frames everything downstream; the user must confirm the decision space before the evaluate stage locks in on it.

## Reviewer guidance specific to this stage

- **Hidden duplicates** (two options that share a theory of change with cosmetic differences) are the highest-priority finding — they make the option set look wider than it is and waste the evaluate stage's effort.
- **Inconsistent shared assumptions** across option models is next — fair comparison demands shared baselines; different discount rates or market-size assumptions across options invalidate the comparative analysis.
- **Missing unconventional option** — a set that's all variations of comfortable choices hasn't done the widening work this stage exists for.
- **Single-point projections without sensitivity** — a model presented as a single endpoint number gives the evaluate stage nothing to stress-test against.
