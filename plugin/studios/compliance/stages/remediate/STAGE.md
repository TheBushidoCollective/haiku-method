---
name: remediate
description: Implement controls, fix gaps, update configurations and policies
hats: [remediation-engineer, policy-writer, verifier]
fix_hats: [classifier, remediation-engineer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: assess
    discovery: gap-report
---

# Remediate

Take the ranked gap list and close the gaps. This is the build-class stage of the compliance lifecycle: units are discrete pieces of executable work — config changes, code changes, policy authorship — each with concrete acceptance criteria and a way to confirm the change actually addresses the gap.

## Scope

Implementing the technical and governance changes that satisfy the open controls, and recording how each change is verified. Remediate decides *how to close each gap and prove it closed* — not whether the gap was correctly graded (that's a revisit to assess) and not how the evidence is packaged for the auditor (that's document).

## What to do

- Trace every change back to the specific gap and control it closes; leave no gap addressed by guesswork.
- Pair each technical acceptance criterion with an executable verify-command, and map each policy clause to the control it satisfies.
- Build changes that are verifiable in isolation, so closure is demonstrable rather than asserted.
- Keep technical and governance remediation distinct even when one gap needs both.

## What NOT to do

- Don't re-grade a control or reopen the scope boundary — a wrong finding is a revisit upstream, not a quiet reinterpretation here.
- Don't assemble the auditor-facing evidence package — that's the document stage.
- Don't claim a gap closed without a verify-command or a clause-to-control mapping that proves it.
- Don't add changes the gap list doesn't call for.
