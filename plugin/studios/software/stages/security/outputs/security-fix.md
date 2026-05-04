---
name: security-fix
location: (project source tree)
scope: repo
format: code
required: false
---

# Security Fix Code

Implementation output for security units that close vulnerability findings. Mirrors the development stage's `code` output template — security-engineer hats may write directly into the project source tree to land controls (input validation, authentication binding, frontmatter parsers, etc.) that defend the attack surface the unit names.

## When to use this template

Security stage units that REMEDIATE a finding produce code, not just an assessment. Without this template, the stage scope only permits intent-relative paths (`stages/security/...`, `knowledge/...`) and security-engineer commits that touch `packages/...` source files would fail scope validation at advance_hat.

Units that ONLY document threats / model risks (threat-modeler hat output, residual-risk register) need ASSESSMENTS (intent-scope) — not this template.

## Content Guide

- **Follow existing project patterns** for file organization, naming conventions, and module boundaries
- **Include appropriate tests** alongside implementation — unit tests for the new control's behavior, regression tests that fail pre-fix
- **Commit working increments** with clear messages naming the finding (V-NN) being closed and the control landed
- **Match the threat-model artifact** — the implementer hat MUST address the threats the threat-modeler enumerated for this unit's surface

## Completion

This output is "complete" when:
- All quality_gates declared on the unit frontmatter pass
- The full project test suite passes
- A behavioural / regression test exists for each finding being closed
- The matching `ASSESSMENTS.md` entry (intent-scope) records the finding as mitigated and cites the file paths and test names

## Quality Signals

- Tests fail pre-fix and pass post-fix (regression coverage proves the control works)
- Lint and typecheck pass without suppressions
- The code follows existing project conventions
- Commits cite the V-NN finding and the threat the control closes
