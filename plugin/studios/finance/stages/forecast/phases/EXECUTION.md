# Forecast Stage — Execution

## Per-unit baton (`analyst → forecaster → verifier`)

Every forecast unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating on disk:

1. **`analyst` (plan):** Reads intent context (strategic plan, prior actuals, market data). Identifies the slice's drivers, pulls and documents the data foundation (sources with reliability and refresh frequency), names leading indicators, and flags data gaps. Hands off when each driver has a defensible data source and the gaps are surfaced explicitly rather than hidden.
2. **`forecaster` (do):** Reads the analyst's foundation. Picks a methodology (driver-based or top-down × bottom-up reconciliation) and names it. States every assumption explicitly per driver. Builds at least three scenarios with **distinct assumption sets** (not scaling factors). Runs sensitivity on the load-bearing assumptions per scenario. Hands off when every projected number traces back through driver → assumption → analyst-sourced data.
3. **`verifier` (verify):** Reads the unit body. Validates substance, citation, internal consistency, and decision-register alignment. Either advances (`haiku_unit_advance_hat`) or rejects with the responsible hat named (`haiku_unit_reject_hat`).

The hat order is `plan → do → verify` because the analyst sets the inputs the forecaster projects against; verifier checks the result without redoing the projection.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `methodology` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `methodology` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `analyst` is the implementer (re-grounds it in evidence); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. A local human reviews scenario plausibility and assumption defensibility before the budget stage consumes the model.

## Reviewer guidance specific to this stage

- **Scenarios that are scaling factors** (base × 1.10 and base × 0.90 labeled as "high" and "low") is the single highest-priority finding — every downstream stage will mis-size risk.
- **Assumption stated without a data source** is the second-priority finding — it's an opinion masquerading as a projection.
- **Driver with no leading indicator and no acknowledgment it will lag** sets up budget construction to be reactive rather than proactive.
- **Time-series extrapolation as the primary forecast method** (rather than as a sanity check on a driver-based model) flags structural-change blindness — the forecast assumes the future looks like the past.
