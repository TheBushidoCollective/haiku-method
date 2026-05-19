# Review Stage — Execution

## Per-unit baton (`reviewer → compliance-officer → verifier`)

Every review unit walks the three hats in order. The baton across the rally race is the unit's slice of `REVIEW-FINDINGS.md` accumulating on disk:

1. **`reviewer` (plan / do for legal lens):** Reads the intake brief, the research memo, and the draft together. Walks the risk inventory against the operative clauses, walks each operative clause for unintended exposure or coverage gap, and categorizes findings by severity. Frames remediation as options for the licensed attorney's evaluation, not as instructions.
2. **`compliance-officer` (do for compliance lens):** Appends the compliance-specific findings. Walks every applicable regulatory regime identified in the research memo against the draft and surfaces gaps where the document fails to address a regime's requirements (or creates a configuration the regime treats as a violation). Multi-jurisdictional matters get per-jurisdiction analysis.
3. **`verifier` (verify):** Reads the findings body and confirms each finding names a specific source provision, traces to a brief / memo / risk-inventory item, has a severity tag, and proposes remediation options. Calls `haiku_unit_advance_hat` on pass; `haiku_unit_reject_hat` if findings are vague or coverage is incomplete.

The hat order is `plan → do → verify`: legal review surfaces the substantive issues, compliance review layers in the regulatory dimension, and verification confirms the findings are actionable for the closer hat in `execute`.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `risk-coverage` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `risk-coverage` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → reviewer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `reviewer` is the implementer (re-authors the affected finding (often adding specificity); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. The workflow waits for the licensed attorney's external sign-off (in whichever review channel the firm uses — outside counsel, in-house GC review, partner approval). Approval is detected by branch merge or external-system signal; the agent does not advance the gate itself.

## Reviewer guidance specific to this stage

When the `risk-coverage` review agent or a human reviewer reads the stage's output:

- **Uncovered risks** are the single highest-priority finding — a risk in the inventory with no addressing provision and no documented acceptance is silent deal exposure.
- **Uncovered compliance requirements** are next — a regulatory requirement from the research memo without a matching provision and without a documented exemption rationale is regulatory exposure.
- **Severity misclassification** — critical tags attached to stylistic preferences (or, worse, advisory tags attached to deal-affecting findings) corrupt the closer hat's prioritization in `execute`.
- **Vague remediation** — "improve the clause" is not a remediation option; specificity is required.
- **Open critical findings reaching the gate** — every critical finding must be resolved before execution; an open critical finding is a gap in the review itself.
