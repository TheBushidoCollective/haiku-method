# Requirements Stage — Execution

## Per-unit baton (`analyst → specifier → verifier`)

Every requirements unit walks the three hats in order. The baton across the rally race is the requirement set accumulating on disk:

1. **`analyst` (plan):** Gathers stakeholders, names the business outcome, captures functional / integration / non-functional / compliance / operational needs cross-functionally, classifies each requirement as mandatory / preferred / nice-to-have with cited business justification, and benchmarks mandatory items against market feasibility. Hands off when every requirement is named, classified, justified, and source-cited.
2. **`specifier` (do):** Reads the structured requirement set and produces the RFP / RFI / RFQ document — testable specifications per requirement, evaluation criteria with weights summing to 100, the scoring scale and anchor points, mandatory gates separated from scored items, TCO components, and the response template vendors fill in. Includes the non-negotiables (data handling, security, compliance, exit provisions, SLA expectations with measurable thresholds). Hands off when every requirement has a testable specification and the methodology is locked.
3. **`verifier` (verify):** Reads each unit's body and validates substance, citation, internal consistency, and decision-register accountability. Advances when the body meets the knowledge-artifact bar; rejects to the responsible hat naming the failed criterion when it doesn't.

The hat order is `plan → do → verify` because the analyst produces the structured input that the specifier turns into the RFP, and the verifier validates that what was produced is substantive enough to drive downstream stages.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate; the built-in spec-conformance subagent confirms the requirements artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's review agents (`specificity`) and any studio-level review agents fire in parallel. Each produces feedback if their lens identifies a finding.
3. **Fix loop (if any feedback opens)** — The stage's `fix_hats:` chain (`classifier → analyst → feedback-assessor`) dispatches against each open feedback. The classifier routes the FB to the right unit; the analyst re-authors the affected requirements; the assessor independently decides closure.
4. **Gate** — The stage's gate is `ask` — a human stakeholder approves the RFP locally before vendors are contacted.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Vague specifications** are the highest-priority finding — they produce incomparable vendor responses, which cascade through evaluate, negotiate, and onboard.
- **Mandatory requirements with no business justification** are reject-worthy — they invite scope-creep arguments later.
- **Evaluation methodology defined after responses arrive** is structurally reject-worthy — the methodology must exist before vendor contact.
- **SLA expectations without measurable thresholds** become unenforceable SLAs in the negotiated contract.
