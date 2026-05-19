# Requirements Stage — Execution

## Per-unit baton (`analyst → specifier → verifier`)

Every requirements unit walks the three hats in order. The baton across the rally race is the requirement set accumulating on disk:

1. **`analyst` (plan):** Gathers stakeholders, names the business outcome, captures functional / integration / non-functional / compliance / operational needs cross-functionally, classifies each requirement as mandatory / preferred / nice-to-have with cited business justification, and benchmarks mandatory items against market feasibility. Hands off when every requirement is named, classified, justified, and source-cited.
2. **`specifier` (do):** Reads the structured requirement set and produces the RFP / RFI / RFQ document — testable specifications per requirement, evaluation criteria with weights summing to 100, the scoring scale and anchor points, mandatory gates separated from scored items, TCO components, and the response template vendors fill in. Includes the non-negotiables (data handling, security, compliance, exit provisions, SLA expectations with measurable thresholds). Hands off when every requirement has a testable specification and the methodology is locked.
3. **`verifier` (verify):** Reads each unit's body and validates substance, citation, internal consistency, and decision-register accountability. Advances when the body meets the knowledge-artifact bar; rejects to the responsible hat naming the failed criterion when it doesn't.

The hat order is `plan → do → verify` because the analyst produces the structured input that the specifier turns into the RFP, and the verifier validates that what was produced is substantive enough to drive downstream stages.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `specificity` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `specificity` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `analyst` is the implementer (re-authors the affected requirements); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. A human stakeholder approves the RFP locally before vendors are contacted.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Vague specifications** are the highest-priority finding — they produce incomparable vendor responses, which cascade through evaluate, negotiate, and onboard.
- **Mandatory requirements with no business justification** are reject-worthy — they invite scope-creep arguments later.
- **Evaluation methodology defined after responses arrive** is structurally reject-worthy — the methodology must exist before vendor contact.
- **SLA expectations without measurable thresholds** become unenforceable SLAs in the negotiated contract.
