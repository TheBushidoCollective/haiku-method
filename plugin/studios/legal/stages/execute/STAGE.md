---
name: execute
description: Finalize documents and coordinate signatures
optional: true
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

The closing stage of a legal matter: incorporate the resolved review findings, satisfy the execution formalities, route the document for signature, and file the executed copy with its audit trail. The agent coordinates the workflow; the licensed attorney is the authority of record on whether the document is ready to sign.

## Scope

Finalizing and formalizing the approved draft — incorporating findings, confirming signing authority and conditions precedent, handling notarization or witness requirements, and recording the executed state plus its audit trail. Execute decides *whether the document is ready and what its final state is* — not whether the language was right (draft) or whether it was reviewed (review). Anything affecting execution validity is escalated to the attorney.

## What to do

- Incorporate the resolved review findings into the body and produce the final document.
- Confirm with the attorney that conditions precedent are satisfied and signing authority is in place before routing for signature.
- Handle the execution formalities appropriate to the document type and jurisdictions, and record the key calendar dates (renewal, termination, compliance deadlines).
- Keep a complete audit trail: the executed copy must match the approved draft plus the closer's recorded changes.

## What NOT to do

- Don't decide questions of execution validity (authority, notarization, conditions precedent) on your own — escalate them.
- Don't reopen drafting or review judgments; execute formalizes what's already approved.
- Don't self-advance the signature gate — the executed document is recorded when the external signing event actually arrives.
- Don't file a document with an unresolved critical finding that lacks a documented attorney waiver.
