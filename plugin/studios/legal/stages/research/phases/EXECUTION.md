# Research Stage — Execution

## Per-unit baton (`researcher → analyst → verifier`)

Every research unit walks the three hats in order. The baton across the rally race is the unit's slice of `RESEARCH-MEMO.md` accumulating on disk:

1. **`researcher` (plan / do for source-gathering):** Reads the unit's research topic, the intake brief, and the matter's jurisdictional scope. Identifies primary and secondary sources, captures each with a verifiable citation, and characterizes settled vs. contested vs. uncertain law. Hands off when the source map is built and the topic's coverage is honest (no fabricated citations, no over-confident "settled" labels).
2. **`analyst` (do for synthesis):** Reads the researcher's source map and turns it into the memo's synthesis sections — applicable framework, application to the matter, strategy options, open questions, recent developments. Frames strategic choices as options the licensed attorney evaluates, not as decisions. Hands off when every applicable rule maps to a specific fact and every open question is resolved or reframed for the attorney.
3. **`verifier` (verify):** Reads the memo body and confirms substance, citation, internal consistency, and decision-register accountability. Calls `haiku_unit_advance_hat` when the memo is substantive and traces to its sources; `haiku_unit_reject_hat` with the responsible hat named if a gap exists.

The hat order is `plan → do → verify`: source-gathering produces the raw material, synthesis turns it into the deliverable, and verification confirms substance before the unit advances.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `authority` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `authority` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → researcher → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `researcher` is the implementer (re-authors the affected section (often correcting a citation); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. The substantive legal-judgment gate is at `draft` and `review`; research's job is to assemble accurate material for the attorney.

## Reviewer guidance specific to this stage

When the `authority` review agent or a human reviewer reads the stage's output:

- **Fabricated citations** are the single highest-priority finding — a citation that can't be verified is treated as fabricated until proven otherwise. This is the failure mode that most reliably surfaces in downstream stages and looks bad when it does.
- **Stale authority** is next — overruled cases, amended statutes, superseded agency guidance. Currency must be confirmed.
- **Wrong-jurisdiction citations** — an on-point authority from the wrong jurisdiction is off-point and misleading.
- **Literature-review pattern** — a memo that summarizes the law without applying it to specific facts is a sign the analyst didn't do their job.
- **Settled-vs-contested mislabeling** — the attorney needs to see uncertainty as uncertainty; calling contested law settled is a critical defect.
