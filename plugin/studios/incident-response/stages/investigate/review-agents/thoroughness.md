---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the investigation identified the actual root cause (not just the proximate trigger), that the timeline is complete and grounded in cited evidence, and that competing hypotheses were tested rather than skipped.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Root cause vs. trigger** — The finding distinguishes the root cause (the systemic condition without which the incident does not occur) from the proximate trigger (the event that exposed the condition). A finding that names "the deploy" as the root cause without naming the underlying defect in that deploy is naming the trigger, not the cause.
- **Timeline gaps explained** — Every gap longer than a small tolerance between events in the timeline either has an explanation (no events occurred, observability gap, etc.) or is flagged as a known unknown. Silent gaps in a SEV-1 timeline are the highest-priority finding.
- **Evidence supports the chain** — Every link in the causal chain is supported by cited log entries, metric values, traces, or change-log references with timestamps. A causal claim with no evidence behind it is a reject.
- **Alternatives ruled out** — At least one competing hypothesis was tested, and the evidence that eliminated it is stated. An investigation with a single hypothesis is incomplete on principle.
- **Cross-system correlation** — Causal claims that span service boundaries cite evidence from both sides with timestamps that line up within tolerance.
- **Contributing factors named** — Conditions that made the incident more likely, more severe, or harder to detect are listed separately from the root cause, each with its own mechanism.
- **Detection latency stated** — The time gap between first anomaly and detection is in the timeline. This is the input to monitoring-improvement action items in the postmortem.

## Common failure modes to look for

- "The deploy caused it" with no mechanism connecting that specific deploy to that specific failure mode
- A timeline that jumps from "first anomaly" to "incident declared" with nothing in between
- A causal chain where one of the links is unsupported — "X led to Y led to Z" but Y has no cited evidence
- A single hypothesis investigated and confirmed; no competing hypotheses tested or ruled out
- "Logs show errors" or "metrics confirmed the issue" without specific entries or values cited
- Contributing factors merged into the root cause section, so it's unclear what the systemic defect actually is
- "Root cause: human error" — humans operate inside systems; the systemic gap that allowed the error to reach production is the cause
- Detection latency missing from the timeline so the postmortem can't identify monitoring gaps
