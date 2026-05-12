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

Take the gap report and close the gaps. This is the only build-class stage in the compliance lifecycle — units here are discrete pieces of executable work (config changes, code changes, policy authorship) with concrete acceptance criteria and verify-commands. The intent-scope `REMEDIATION-LOG.md` records what was changed, where, and how to confirm the change actually addresses the gap.

## Per-unit baton

Each remediation unit walks the three hats in `plan → do → verify` order:

- **`remediation-engineer`** (plan / do for technical controls) reads the gap, designs the technical change (config, code, infrastructure), implements it, and pairs every acceptance criterion with a verify-command
- **`policy-writer`** (do for governance controls) drafts or updates the policy / procedure / standard required by the gap, mapping each policy clause back to the controls it satisfies
- **`verifier`** (verify) runs the unit's verify-commands, confirms the body substantively matches the spec, and either advances or rejects to the responsible hat

Some units will use only the engineer (pure technical control), some only the policy-writer (pure governance control), some both — the chain accommodates either.

## Inputs and outputs

`assess/gap-report` feeds in. The output `REMEDIATION-LOG.md` is intent-scope and feeds `document` (every change needs an evidence trail) and indirectly `certify` (the auditor reads the log to confirm gap closure).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, remediation-engineer, feedback-assessor]` dispatches per finding — `remediation-engineer` re-implements the technical change or routes governance-only findings via classifier to `policy-writer` through a separate dispatch. The gate is `ask`: a human approves locally because remediation often touches production systems and the cost of an unreviewed change in this domain is high. Project overlays may declare the project's actual stack (test runners, deployment platforms, policy-management systems) so verify-commands resolve correctly.
