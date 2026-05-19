# Options Stage — Execution

## Per-unit baton (`ideator → modeler → verifier`)

Every options unit walks the three hats in order. The baton is the unit's body — option set first, models second, verification last:

1. **`ideator` (plan):** Reads the landscape analysis and the unit's strategic axis. Generates at least three genuinely distinct options including at least one unconventional alternative. For each option writes name, value proposition, theory of change, strategic stance, and "what this option is NOT". Hands off when the set is differentiated and every option has a stated causal chain.
2. **`modeler` (do):** Reads the ideator's option set. Pins shared assumptions (time horizon, discount rate, market sizing, cost baselines) once, then builds the parallel financial / operational model per option. Includes sensitivity analysis on top drivers and names the killer assumptions per option. Hands off when every option has a model using the same structure and the killer assumptions are surfaced.
3. **`verifier` (verify):** Reads the unit body. Checks substance, traceability to landscape inputs, internal coherence, and decision-register consistency per the body-only mandate. Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because differentiation is a planning decision; building a model around an option that's secretly the same as another option wastes the modeler's work and corrupts the comparison.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `differentiation` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `differentiation` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → ideator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `ideator` is the implementer (re-thinking the option set when distinction or theory-of-change is the gap); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Local human approval. The option set frames everything downstream; the user must confirm the decision space before the evaluate stage locks in on it.

## Reviewer guidance specific to this stage

- **Hidden duplicates** (two options that share a theory of change with cosmetic differences) are the highest-priority finding — they make the option set look wider than it is and waste the evaluate stage's effort.
- **Inconsistent shared assumptions** across option models is next — fair comparison demands shared baselines; different discount rates or market-size assumptions across options invalidate the comparative analysis.
- **Missing unconventional option** — a set that's all variations of comfortable choices hasn't done the widening work this stage exists for.
- **Single-point projections without sensitivity** — a model presented as a single endpoint number gives the evaluate stage nothing to stress-test against.
