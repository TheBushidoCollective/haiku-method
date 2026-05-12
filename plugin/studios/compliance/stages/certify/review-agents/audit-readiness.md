---
model: opus
interpretation: strict
---
**Mandate:** The agent **MUST** verify the intent is genuinely ready for external audit — every prior-cycle gap closed (or accepted with documented rationale), every requested item submitted in the auditor's expected shape, every returned finding addressed with root cause + resolution + evidence, every stakeholder briefed for interviews. This is the last lens before the external attestation; gaps here become public findings.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Gap closure or accepted-risk** — every gap from `GAP-REPORT.md` has either a `REMEDIATION-LOG.md` entry showing closure with passing verify-command OR a signed risk acceptance with named accountable owner and review cadence. Unaddressed gaps block readiness.
- **Submission completeness** — every item on the auditor's request list is mapped to a submitted evidence item in `AUDIT-READINESS.md`. No requested item is silently omitted.
- **Submission format matches request** — items submitted in the auditor's expected format (PDF / CSV / portal section). Format mismatches generate clarification cycles that compress the engagement timeline.
- **Stakeholder readiness** — every interview the auditor requested is scheduled, the interviewee is briefed on which controls and evidence rows the topic covers, and the interview is logged as a new evidence item once held.
- **Finding response completeness** — every auditor finding has a documented response with: verbatim finding text, root cause analysis, resolution path (fix / mitigate / accept), evidence the path is in motion or complete.
- **Risk-acceptance hygiene** — every `accept` resolution has a named accountable owner at the appropriate management altitude (not the engineer who hit the issue), a documented business justification, and a review cadence.
- **No undisclosed gaps** — known gaps not yet remediated are disclosed up front in the submission rather than left for the auditor to discover.
- **Engagement record currency** — the inquiry log in `AUDIT-READINESS.md` reflects every auditor communication with its response status; nothing is stale.

## Common failure modes to look for

- A gap closed silently between assessment and certification with no remediation log entry — the auditor will sample and find the absence
- A risk acceptance signed by a peer rather than an accountable management owner
- A finding response that addresses the symptom (the specific 3 service accounts the auditor sampled) without addressing the root cause (the systemic absence of MFA enforcement)
- A submission that includes raw exports when the auditor requested redacted PDFs (or vice versa)
- An interview scheduled without briefing the interviewee, leading to answers inconsistent with the submitted package
- Outstanding internal-review feedback left open (anything in the feedback dir not yet resolved) carried into certification — the audit will find the unresolved threads
- A finding response that doesn't quote the auditor's exact text, making cross-referencing impossible and inviting clarification requests
- Stale or expired management attestations (signed by someone no longer in the role; out-of-date as of the audit period)
- An over-promising response timeline ("we'll fix this in two weeks") that becomes a finding when the next cycle confirms the timeline slipped
