**Focus:** Write a blameless postmortem that turns the incident into organizational learning. The narrative tells the full story — detection, response, root cause, contributing factors, prevention — in a way that someone who wasn't on the call can understand and that someone on the next on-call rotation can learn from. The postmortem is for learning, not accountability. Naming individuals as the cause is a documented anti-pattern; systemic gaps are the subject.

## Process

### 1. Establish the blameless frame

Before writing, internalize the blameless lens: every action a human took during the incident was the locally rational choice given what they knew at that moment. The postmortem describes the systemic conditions (alerting gaps, knowledge gaps, tooling gaps, process gaps) that made the locally rational choice produce a bad outcome — not the human who made the choice.

Practical language patterns:

- Write actions in passive or system-attributed voice ("the deploy was rolled back," "the alert routed to the on-call rotation") rather than naming the individual unless their role is the salient detail
- Where naming a role is needed, use the role ("the on-call engineer," "the IC") rather than the person
- Frame mistakes as system findings, not personal findings: "the team did not have a runbook for this failure mode" rather than "the engineer didn't know what to do"

### 2. Write the timeline

The timeline is the spine of the postmortem. Reconstruct it from the cited evidence in the investigate and mitigate artifacts. Every entry has a timestamp, a source, and a one-line description of what changed in the system or what the response did:

```
T+00:00  First anomaly:        error rate on /api/checkout crossed warning threshold (source: observability platform)
T+02:14  Alert fired:           paging rotation paged the on-call (source: paging system)
T+03:47  IC declared:           SEV-2 declared, scribe and comms lead assigned (source: incident channel)
T+05:22  First mitigation:      deploy X-123 rolled back (source: mitigation log)
T+09:01  Recovery confirmed:    error rate back below warning threshold for 5+ minutes (source: observability platform)
T+15:30  Customer comms:        status page updated to "resolved" (source: status page)
```

Do not skip the "boring" parts between events. A 12-minute gap between detection and IC declaration is itself a finding; if you compress it, the action items downstream will miss the response-time improvement work.

### 3. Tell the detection story

How was the incident found? Was it caught by alerting, by a customer report, by an engineer noticing something wrong on a dashboard? What was the gap between the first anomaly the system experienced and the moment a human became aware? That gap (detection latency, often abbreviated MTTD) is one of the highest-leverage improvement targets — a fix that closes the alerting gap helps every future incident in this class, not just this one.

If the detection was driven by a customer report rather than internal alerting, name that explicitly. It's a finding, and it should produce monitoring action items.

### 4. Tell the response story

Walk the response: who paged whom, how long until the IC declared, how quickly the right roles were assigned, what mitigations were attempted (including the ones that didn't work), how long until recovery was confirmed. Cite the mitigation log for specific actions and the incident channel for coordination decisions.

Response time has several useful sub-measures:

- Time from detection to IC declared (coordination latency)
- Time from declaration to first mitigation applied (response latency)
- Time from first mitigation to recovery confirmed (mitigation latency)
- Time from recovery to customer-facing communication (comms latency)

Name the ones that are notably long; they're action-item inputs.

### 5. Write the root-cause section

This is the investigate stage's output, written for a wider audience. State the root cause in plain language, distinguish it from contributing factors, and explain the mechanism — how the systemic condition produced the observable failure. Cite the evidence the investigate stage gathered.

If the root cause is "a class of defect rather than a single instance" (which is often true), state the class explicitly. Action items in the prevention section will target the class.

### 6. Identify prevention measures

For each gap the incident exposed (detection gap, response gap, root cause gap, tooling gap), name a prevention measure that addresses it systemically. Specific monitoring, specific runbook, specific architectural change, specific test, specific process improvement. These flow into the action-item-tracker hat as the raw material.

Prevention measures must address the class, not just the instance. "Add a check for the specific value that broke" is necessary but not sufficient; "harden the input-validation contract for this surface class" is the systemic measure.

## Format guidance

The postmortem document typically includes (in this order):

- Header: incident slug, severity, declared-at, resolved-at, duration, customer impact summary
- One-paragraph summary for executive audience
- Timeline (as above)
- Detection: how the incident was found, detection latency, alerting evaluation
- Response: how the response unfolded, coordination latency, mitigation latency
- Root cause: the systemic condition, the mechanism, the cited evidence
- Contributing factors: separate from the root cause, each with its own mechanism
- Action items (this stage's action-item-tracker hat appends)
- Lessons / what went well / what we can improve

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** assign blame to individuals — humans are not the root cause; systemic gaps that produced the locally rational mistake are the subject
- The agent **MUST NOT** skip the "boring" parts of the timeline between detection and resolution — gaps in the narrative hide the improvement targets
- The agent **MUST** include the detection story; how the incident was found is as important as what caused it
- The agent **MUST NOT** propose only tactical patches ("add a check here") without addressing the systemic gap the incident exposed
- The agent **MUST NOT** write the postmortem for compliance audience — a document nobody reads prevents nothing
- The agent **MUST** distinguish the root cause from contributing factors with a stated mechanism for each
- The agent **MUST** cite specific evidence from the investigate and mitigate artifacts; "logs showed the issue" is not citation
- The agent **MUST NOT** suppress an embarrassing finding — postmortems that hide difficult truths are how organizations stop learning
- The agent **MUST** state detection latency, coordination latency, response latency, and comms latency where measurable; these are the inputs to most prevention work
