---
name: test-results
location: .haiku/intents/{intent-slug}/stages/execute-tests/artifacts/
scope: intent
format: text
required: true
---

# Test Results

Test execution results with evidence, defect reports, and coverage metrics. Two artifact families land here: defect entries the `reporter` hat files for each failing case, and execution-progress metrics appended to each unit's body.

## Content Guide

- **Execution summary** — pass/fail/skip counts with overall coverage percentage
- **Test results** — each test case with status and evidence (screenshots, logs for failures)
- **Defect reports** — each defect with reproduction steps, environment, severity, and root cause hypothesis
- **Blocked tests** — tests that could not be executed with reasons and impact assessment
- **Coverage metrics** — execution percentage against planned suite with gap justification
- **Environment record** — test environment configuration confirming production fidelity

## Quality Signals

- All planned tests are accounted for (pass, fail, skip, blocked)
- Failures include evidence sufficient for defect reproduction
- Defect reports have reproduction steps, severity, and environment details
- Coverage metrics are accurate against the planned test suite

## Defect entry shape

```
DEFECT ID: <stable ID — match the project's taxonomy if one exists>
Title: <one-line, observable, in user language>
Severity: <P0 / P1 / P2 / P3 — match the strategy>
Category: <design / code / environment / data / integration / regression>
Status: open

Failing case: <TC-ID from the spec>
Environment: <env identifier, build / commit, feature-flag state>

Steps to reproduce:
1. <preconditions — state of system / data / auth>
2. <action 1>
3. <action 2>

Expected behavior:
- <what should happen, as the spec defines it>

Observed behavior:
- <what actually happened, including exact error messages, status codes, missing UI states>

Evidence:
- <reference to screenshot / payload / log excerpt>

Root cause hypothesis (if determinable from evidence):
- <best-evidence hypothesis OR "undetermined; logs / traces do not localize">

Frequency:
- <always reproduces / intermittent (N of M attempts) / once observed>

Workaround:
- <if any known>
```

## Execution-progress metrics block

Appended to each unit's body per slice:

```
EXECUTION METRICS — <slice identifier>

Planned cases: <N>
Executed: <N>      (<%>)
PASS: <N>          (<%> of executed)
FAIL: <N>          (<%> of executed)
BLOCKED: <N>       (<%> of executed)
SKIPPED: <N>       (<%> of executed)

Open defects by severity:
- P0: <N>
- P1: <N>
- P2: <N>
- P3: <N>

Open defects by category:
- design: <N>
- code: <N>
- environment: <N>
- data: <N>
- integration: <N>
- regression: <N>

Coverage vs strategy exit criteria:
- <criterion>: <met / not-met> with <evidence reference>
```

Metrics here are descriptive — they show what was run and what's outstanding. The `analyze` stage interprets trends, root-cause distributions, and trend significance.
