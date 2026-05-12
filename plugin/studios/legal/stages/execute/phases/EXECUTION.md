# Execute Stage — Execution

## Per-unit baton (`closer → administrator → verifier`)

Every execute unit walks the three hats in order. The baton across the rally race is the unit's `EXECUTED-DOCUMENT.md` accumulating on disk:

1. **`closer` (plan / do for finalization):** Reads `REVIEW-FINDINGS.md` and the attorney's disposition for each finding. Incorporates accepted changes, applies negotiated language, records formally waived findings, and produces the final body. Maintains the change log entry for every modification from approved draft to executed copy. Confirms with the licensed attorney that conditions precedent are satisfied (signing authority, board approval, conditions tied to performance, etc.). Blocks (via `haiku_unit_reject_hat`) if any review finding remains unresolved.
2. **`administrator` (do for filing and retention):** Verifies execution formalities (signing authority, witness / notarization / apostille / legalization where applicable, electronic-vs-original-counterparts requirement for this document type and jurisdiction). Builds the retention record (party identification, governing law, term, key dates, related-document references). Indexes the version history with every meaningful round preserved. Records key dates with the action each triggers (renewal notice window, termination-for-convenience period, compliance deadlines).
3. **`verifier` (verify):** Reads the final body, the change log, the conditions-precedent checklist, and the retention record. Confirms every review finding is resolved (incorporated, negotiated, or formally waived), the change log is complete, formalities are confirmed, and the retention record matches the org's repository schema. Calls `haiku_unit_advance_hat` on pass; `haiku_unit_reject_hat` if any item is incomplete.

The hat order is `plan → do → verify`: finalization produces the executable body, administration produces the retention record, and verification confirms the executed artifact is defensible.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `formality` review agent fires (`interpretation: strict`), checking that every review finding is resolved, the change log is complete, conditions precedent are confirmed, execution formalities are correct, and the retention record is properly indexed.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, closer, feedback-assessor]` dispatches per finding. Classifier routes; closer re-authors the affected section or audit-trail entry; assessor closes.
4. **Gate** — The gate is `await`. The workflow blocks until the external signature event arrives (countersigned PDF, electronic-signature platform completion, attorney confirmation of execution). The agent does not self-advance this gate.

## Reviewer guidance specific to this stage

When the `formality` review agent or a human reviewer reads the stage's output:

- **Open review findings reaching execution** is the single highest-priority finding — every finding from the review stage must be resolved (incorporated, negotiated, or formally waived with rationale and attorney sign-off).
- **Change-log gaps** — a body change without a change-log entry undermines the audit trail; the executed record must be defensible.
- **Formality errors** — wrong signing authority, missing notarization where required, electronic execution where original counterparts are required.
- **Retention indexing errors** — wrong matter ID, party common-name instead of legal name, missing related-document references.
- **Unrecorded key dates** — auto-renewal triggers, termination-for-convenience notice periods, and compliance deadlines must each be captured with their required action.
