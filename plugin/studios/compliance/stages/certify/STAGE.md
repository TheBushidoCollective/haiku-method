---
name: certify
description: Prepare for and support external audit, address findings
optional: true
hats: [audit-liaison, finding-resolver, verifier]
fix_hats: [classifier, audit-liaison, feedback-assessor]
review: [external, await]
elaboration: autonomous
inputs:
  - stage: document
    discovery: evidence-package
review-agents-include:
  - stage: assess
    agents: [thoroughness]
  - stage: remediate
    agents: [effectiveness]
---

# Certify

The external-audit stage and the terminus of the compliance lifecycle. The internal work has produced scope, findings, remediations, and an evidence package; now an external auditor evaluates the result and either certifies, requires changes, or raises follow-up findings. This stage runs that relationship to a resolved outcome.

## Scope

Coordinating the auditor relationship and resolving findings — schedule the audit, hand over evidence in the requested format, respond to inquiries, and drive every finding to closure. Certify owns *the external attestation process and finding resolution* — it does not re-run the upstream assessment or remediation, though it may surface a finding that sends work back there.

## What to do

- Submit evidence in the auditor's requested format and anticipate the follow-up questions before they're asked.
- Give every auditor finding a tracked resolution path: root-cause plus remediation evidence, or documented risk acceptance.
- Treat the external auditor's decision as the authoritative signal; align internal stakeholders before that conversation, not during it.
- Record what was submitted, what came back, and how each finding was resolved.

## What NOT to do

- Don't re-do the assessment or re-author remediations inline — route a substantive finding back to the stage that owns it.
- Don't reformat or re-collect the evidence package from scratch — that was the document stage's job.
- Don't substitute a local sign-off for the external attestation; the auditor's decision is the whole point of this stage.
- Don't leave a finding without an owned, tracked resolution.
