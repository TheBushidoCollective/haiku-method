---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that every remediation in `REMEDIATION-LOG.md` actually closes the gap it claims to close — root cause addressed, change reproducible, verify-command passing, enforcement in place. Surface-only fixes are how gaps re-open in the next assessment.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Gap-to-remediation traceability** — every gap from `GAP-REPORT.md` (above accepted-risk threshold) has a corresponding entry in `REMEDIATION-LOG.md`. Gaps without remediation are silent — they must be explicit (planned for next cycle, accepted with documented rationale, OR closed with this remediation).
- **Root-cause depth** — each remediation names the root cause and addresses it, not just the symptom. A surface-only fix re-opens the gap predictably.
- **Reproducible change** — each remediation cites the concrete artifact of the change (commit SHA, config file path, policy document version). "I clicked through the console" is not reproducible.
- **Verify-command exists and passes** — every acceptance criterion is paired with a concrete verify-command that returns a clear pass / fail signal. The command's output (or hash) is cited or linked.
- **Verify-command is honest** — the command actually exercises the control in the bound environment; synthetic-success in dev does not evidence production effectiveness.
- **Policy ↔ practice alignment** — for governance remediations, the published policy matches the actual operational practice. Aspirational policies fail the next audit.
- **Enforcement named** — each policy clause is paired with an enforcement mechanism (technical control or attestation cadence). Decorative policies do not satisfy controls.
- **Monitoring against drift** — remediations include the alerting / monitoring / review-cadence that prevents the gap from recurring. One-shot fixes drift.

## Common failure modes to look for

- A gap closed by a code change that addresses only one of multiple instances of the same root cause (one application's auth flow fixed; the other three still vulnerable)
- A remediation with a verify-command that doesn't actually run against the bound environment (synthetic test in CI that passes by mocking the very thing the control is supposed to enforce)
- A policy written and "published" with no enforcement mechanism — the next audit sees the policy and the violations side-by-side
- A configuration change applied via console / manual edit, with no infrastructure-as-code path that makes the next-created resource inherit the setting
- Stale credentials rotated without removing the root cause (the next set of credentials will leak through the same channel)
- A remediation log entry that cites a ticket or PR that hasn't actually merged / shipped (claimed-done before actually-done)
- A remediation that closes the surface gap but introduces a new gap (over-permissive IAM "fix" that grants more than the control allows)
- A gap acknowledged but quietly moved to "next cycle" without a documented risk acceptance — silent deferrals are how audit findings repeat
