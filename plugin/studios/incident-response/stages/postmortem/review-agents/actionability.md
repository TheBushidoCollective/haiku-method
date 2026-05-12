---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the postmortem produces actionable, owned, and tracked improvements that address systemic gaps (not just the specific incident instance), and that the narrative supports those improvements with cited evidence.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Action items are specific and testable** — Each item names a concrete deliverable that someone could execute without asking "what does this mean?" Vague items ("improve monitoring," "better runbooks") are findings.
- **Action items are owned** — Each item names an individual or clearly-scoped rotation, not "the team" or "TBD." Unowned items don't get done.
- **Action items are tracked** — Each item has a reference to the team's work-management system (ticket ID or URL). Postmortem-only items are forgotten.
- **Prevention addresses systemic gaps** — Action items target the class of failure, not just the specific instance that occurred. "Add a check for this specific value" alone is not systemic; "harden the input-validation contract for this surface class" is.
- **Detection improvements present** — If the incident was detected after a significant latency or was customer-reported, the action items include detection-improvement work.
- **Timeline is accurate and complete** — Every timeline entry has a timestamp and source. Gaps between events are explained or flagged.
- **Blameless framing** — The narrative does not name individuals as the cause; systemic conditions are the subject.
- **Detection-and-response measures stated** — Detection latency, coordination latency, response latency, and comms latency appear where measurable. These are the inputs to most prevention work.
- **Priorities distinguish urgency** — Action items are not flat-priority; some are P0/P1, others P2/P3, with reasoning implied by category.

## Common failure modes to look for

- Action items that read "improve X" with no concrete deliverable
- Action items without owners, or with "the team" as owner
- Action items not filed in any tracker — they live only in the document
- A postmortem with 25 P1 action items (functionally no priority)
- Root cause framed as "human error" with no analysis of the systemic conditions that allowed the error to reach production
- Timeline that jumps from "first anomaly" to "incident declared" with nothing in between
- Action items target the specific failing value or path but not the class of defect
- No action item addresses the detection gap when detection was clearly delayed
- Individuals named as the cause; the postmortem reads as accountability rather than learning
- Lessons section restates the timeline without naming what was learned or what will change
