---
name: execute
description: Finalize documents and coordinate signatures
hats: [closer, administrator, verifier]
fix_hats: [classifier, closer, feedback-assessor]
review: await
elaboration: autonomous
inputs:
  - stage: review
    discovery: review-findings
  - stage: draft
    output: draft-document
outputs:
  - output: executed-document
    hat: closer
---

# Execute

Take the reviewed draft, incorporate the resolved findings, run the execution formalities, and file the executed document. Execute is an operational-class stage: each unit corresponds to one operational step — finalizing the body, validating execution prerequisites (signing authority, conditions precedent, notarization or witness requirements as the jurisdiction requires), routing for signature, and post-execution filing. The output is an `EXECUTED-DOCUMENT.md` per unit recording the final state plus the audit trail.

The agent coordinates the workflow; the licensed attorney is the authority of record on whether the document is ready to execute. Anything that affects execution validity (signing authority, notarization, conditions precedent, choice-of-law implications) is **escalated** to the attorney, not decided autonomously.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`closer`** (plan / do for finalization) — incorporates the resolved review findings into the body, produces the final document, and confirms with the attorney that conditions precedent are satisfied
- **`administrator`** (do for filing) — verifies execution formalities are appropriate for the document type and jurisdictions, organizes the version history, and records the key calendar dates (renewal, termination, compliance deadlines)
- **`verifier`** (verify) — confirms the audit trail is complete, the executed copy matches the approved draft plus the closer's recorded changes, and every critical finding from review was either incorporated or has a documented attorney waiver

## Inputs and outputs

Execute consumes `review/review-findings` and the upstream `draft/draft-document`. It produces an `EXECUTED-DOCUMENT.md` per unit at intent scope, holding the final body and the execution metadata.

## Fix loop and gate

`fix_hats: [classifier, closer, feedback-assessor]` dispatches per finding. Classifier routes; closer re-authors the affected section or audit-trail entry; assessor closes. The gate is `await` — the workflow blocks until the external signature event arrives (countersigned PDF, electronic-signature platform completion event, attorney confirmation). The agent does not self-advance this gate.
