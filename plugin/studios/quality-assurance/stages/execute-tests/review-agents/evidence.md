---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the execution record is complete, evidence-backed, and trustworthy enough for `analyze` and `certify` to depend on. The downstream stages only have what this stage records — gaps here propagate as gaps in certification.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Result completeness** — Every case in the upstream test-suite-spec slice has a recorded result (`PASS`, `FAIL`, `BLOCKED`, `SKIPPED`). Silent omissions are findings.
- **Evidence per result** — Every result has an evidence reference appropriate to its type (screenshot / video for UI, payload / status for API, log excerpts for failures, metric output for performance, conformance output for accessibility).
- **Environment fidelity confirmation** — The slice's environment-class and fidelity contract from the strategy are verified before execution and the verification is recorded.
- **Blocked / skipped justification** — Every BLOCKED case has a specific blocking reason and a removable / persistent classification. Every SKIPPED case cites a strategy line or Decision authorizing the skip.
- **Defect-entry completeness** — Every failing case has a defect entry OR is linked to an existing one. Every entry has reproduction steps, environment context, evidence reference, severity, category, and frequency.
- **Severity / category consistency** — Severity bands and defect categories match the upstream strategy's taxonomy across all sibling units.
- **Duplicate handling** — Failures with identical signatures collapse into one defect entry with multiple data points, not multiple entries.
- **Metrics integrity** — Execution-progress metrics have explicit numerators and denominators. Coverage-vs-exit-criteria is filled per slice.
- **Retest discipline** — Cases that were re-run after a fix carry both the original FAIL and the retest result with fresh evidence.

## Common failure modes to look for

- A case recorded `PASS` with no evidence reference — unverifiable
- A `FAIL` with the evidence pointing only at a log line that doesn't contain the failure window
- A `BLOCKED` with reason `"environment issue"` — too vague for the next reviewer
- A `SKIPPED` with no cited approval
- Multiple defect entries for what's clearly the same root cause across different test cases
- Severity labels drifting (the strategy says P0–P3 and the entry says `"Critical"`)
- A defect's root cause stated as conclusion when the evidence supports only a hypothesis
- Metrics aggregated across the whole intent without per-slice breakdown — slices not progressing get hidden
- A retest entry that reuses the original failure screenshot
- Execution started without environment-fidelity verification recorded
