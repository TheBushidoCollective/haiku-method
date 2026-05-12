# Review Stage — Execution

## Per-unit baton (`reviewer → compliance-officer → verifier`)

Every review unit walks the three hats in order. The baton across the rally race is the unit's slice of `REVIEW-FINDINGS.md` accumulating on disk:

1. **`reviewer` (plan / do for legal lens):** Reads the intake brief, the research memo, and the draft together. Walks the risk inventory against the operative clauses, walks each operative clause for unintended exposure or coverage gap, and categorizes findings by severity. Frames remediation as options for the licensed attorney's evaluation, not as instructions.
2. **`compliance-officer` (do for compliance lens):** Appends the compliance-specific findings. Walks every applicable regulatory regime identified in the research memo against the draft and surfaces gaps where the document fails to address a regime's requirements (or creates a configuration the regime treats as a violation). Multi-jurisdictional matters get per-jurisdiction analysis.
3. **`verifier` (verify):** Reads the findings body and confirms each finding names a specific source provision, traces to a brief / memo / risk-inventory item, has a severity tag, and proposes remediation options. Calls `haiku_unit_advance_hat` on pass; `haiku_unit_reject_hat` if findings are vague or coverage is incomplete.

The hat order is `plan → do → verify`: legal review surfaces the substantive issues, compliance review layers in the regulatory dimension, and verification confirms the findings are actionable for the closer hat in `execute`.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `risk-coverage` review agent fires, confirming every inventory risk has an addressing provision or attorney-recorded acceptance, every compliance requirement maps to a provision, and severity tags are accurate.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, reviewer, feedback-assessor]` dispatches per finding. Classifier routes; reviewer re-authors the affected finding (often adding specificity, citation, or escalating back to draft via cross-stage feedback when a clause itself needs rewriting); assessor closes.
4. **Gate** — The gate is `external`. The workflow waits for the licensed attorney's external sign-off (in whichever review channel the firm uses — outside counsel, in-house GC review, partner approval). Approval is detected by branch merge or external-system signal; the agent does not advance the gate itself.

## Reviewer guidance specific to this stage

When the `risk-coverage` review agent or a human reviewer reads the stage's output:

- **Uncovered risks** are the single highest-priority finding — a risk in the inventory with no addressing provision and no documented acceptance is silent deal exposure.
- **Uncovered compliance requirements** are next — a regulatory requirement from the research memo without a matching provision and without a documented exemption rationale is regulatory exposure.
- **Severity misclassification** — critical tags attached to stylistic preferences (or, worse, advisory tags attached to deal-affecting findings) corrupt the closer hat's prioritization in `execute`.
- **Vague remediation** — "improve the clause" is not a remediation option; specificity is required.
- **Open critical findings reaching the gate** — every critical finding must be resolved before execution; an open critical finding is a gap in the review itself.
