---
name: certify
description: Prepare for and support external audit, address findings
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

The external-audit stage. The internal lifecycle has produced scope, findings, remediations, and an evidence package — now an external auditor evaluates the result and either issues a certification, requires changes, or raises follow-up findings. Units here are operational steps with preconditions, actions, and post-condition checks: schedule the auditor, hand over evidence in the requested format, respond to inquiries, resolve findings.

## Per-unit baton

Each certify unit walks the three hats in `plan → do → verify` order:

- **`audit-liaison`** (plan / do) coordinates the auditor relationship — submits evidence per the auditor's request format, anticipates follow-up questions, schedules stakeholder interviews
- **`finding-resolver`** (do for closure) responds to each auditor finding with root cause analysis plus remediation evidence OR documented risk acceptance — every finding gets a tracked resolution path
- **`verifier`** (verify) validates that each unit body names concrete preconditions, an unambiguous action, a verifiable post-condition, and a rollback procedure where applicable

## Inputs and outputs

`document/evidence-package` feeds in. This stage also pulls in upstream review lenses (`assess.thoroughness`, `remediate.effectiveness`) so cross-stage findings surface here before certification rather than during the audit itself. The terminal output is the intent-scope `AUDIT-READINESS.md` — the record of what was submitted, what findings came back, and how each was resolved.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, audit-liaison, feedback-assessor]` dispatches per finding — `audit-liaison` re-submits or re-formats material, escalating to `finding-resolver` via classifier when the finding requires a substantive response rather than a procedural fix. The gate is `[external, await]`: the auditor's decision is the approval signal, and the stage blocks waiting for that external event. There is no local fallback because no local sign-off can substitute for the external attestation that is the whole point of this stage. Project overlays may add the specific auditor's portal conventions, naming schemes, and submission formats.
