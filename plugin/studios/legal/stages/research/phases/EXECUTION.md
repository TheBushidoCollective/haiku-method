# Research Stage — Execution

## Per-unit baton (`researcher → analyst → verifier`)

Every research unit walks the three hats in order. The baton across the rally race is the unit's slice of `RESEARCH-MEMO.md` accumulating on disk:

1. **`researcher` (plan / do for source-gathering):** Reads the unit's research topic, the intake brief, and the matter's jurisdictional scope. Identifies primary and secondary sources, captures each with a verifiable citation, and characterizes settled vs. contested vs. uncertain law. Hands off when the source map is built and the topic's coverage is honest (no fabricated citations, no over-confident "settled" labels).
2. **`analyst` (do for synthesis):** Reads the researcher's source map and turns it into the memo's synthesis sections — applicable framework, application to the matter, strategy options, open questions, recent developments. Frames strategic choices as options the licensed attorney evaluates, not as decisions. Hands off when every applicable rule maps to a specific fact and every open question is resolved or reframed for the attorney.
3. **`verifier` (verify):** Reads the memo body and confirms substance, citation, internal consistency, and decision-register accountability. Calls `haiku_unit_advance_hat` when the memo is substantive and traces to its sources; `haiku_unit_reject_hat` with the responsible hat named if a gap exists.

The hat order is `plan → do → verify`: source-gathering produces the raw material, synthesis turns it into the deliverable, and verification confirms substance before the unit advances.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `authority` review agent fires, checking citation verifiability, jurisdictional fit, currency, primary-vs-secondary discipline, and the rule-to-fact mapping.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, researcher, feedback-assessor]` dispatches per finding. Classifier routes; researcher re-authors the affected section (often correcting a citation, adding a jurisdictional layer, or surfacing a contested-law characterization the original draft missed); assessor closes.
4. **Gate** — The gate is `auto`. The substantive legal-judgment gate is at `draft` and `review`; research's job is to assemble accurate material for the attorney.

## Reviewer guidance specific to this stage

When the `authority` review agent or a human reviewer reads the stage's output:

- **Fabricated citations** are the single highest-priority finding — a citation that can't be verified is treated as fabricated until proven otherwise. This is the failure mode that most reliably surfaces in downstream stages and looks bad when it does.
- **Stale authority** is next — overruled cases, amended statutes, superseded agency guidance. Currency must be confirmed.
- **Wrong-jurisdiction citations** — an on-point authority from the wrong jurisdiction is off-point and misleading.
- **Literature-review pattern** — a memo that summarizes the law without applying it to specific facts is a sign the analyst didn't do their job.
- **Settled-vs-contested mislabeling** — the attorney needs to see uncertainty as uncertainty; calling contested law settled is a critical defect.
