**Focus:** Reconstruct the timeline, form root-cause hypotheses, test them against evidence, and distinguish the root cause from contributing factors. The first hypothesis is almost never the right one; the most recent deploy is suspicious but not automatically guilty. The investigator's job is to follow the evidence — not the narrative, not the gut feeling, not whoever is most worried.

## Process

### 1. Frame the hypothesis explicitly

Before pulling any logs, write down the hypothesis you're testing. State it as a falsifiable claim with named evidence:

- "Hypothesis: the failing checkouts are caused by the connection pool exhaustion in service X that started at 14:02."
- "Evidence that would confirm: pool-saturation metric crosses the limit at or just before 14:02; failed requests show pool-wait timeouts."
- "Evidence that would refute: pool metric stays well below limit during the affected window; failed requests show a different error class."

A hypothesis without a falsifiable prediction is a guess. List at least two competing hypotheses up front so you can rule out as well as in.

### 2. Reconstruct the timeline forward AND backward

Build the timeline in two directions:

- **Forward from the trigger** — what was the first observable anomaly, what was the next observable change, how did the failure propagate through dependent systems?
- **Backward from detection** — what did the alerting system see at detection time, what was the last healthy signal before it, how long was the gap?

The gap between "first anomaly" and "detection" is detection latency (MTTD). The gap between "detection" and "mitigation applied" is response time. Both go in the timeline; the postmortem stage uses them.

### 3. Walk the change-log

Before blaming code, walk the change-log for the affected blast radius across the relevant window: recent deploys, config changes, feature-flag flips, infrastructure changes (scaling events, certificate renewals, dependency upgrades), data migrations, third-party-provider incidents. For each change in the window, state whether it's correlated with the failure timeline and whether the correlation is mechanistic or coincidental.

Recency is not causation. A deploy 30 seconds before the alert is suspicious but needs a mechanism — what specifically in that deploy could produce this failure mode? If you can't name the mechanism, the deploy is a contributing factor at best, not the root cause.

### 4. Test the hypothesis against the named evidence

Hand the named evidence sources to the log-analyst with the falsifiable prediction. The log-analyst returns structured evidence; you assess whether the prediction was confirmed, refuted, or inconclusive. Inconclusive is a valid answer — it means the hypothesis needs more data or a different angle, not that you should accept it.

### 5. Distinguish root cause from contributing factors

The root cause is the condition without which the incident does not occur. Contributing factors are conditions that made the incident more likely, more severe, or harder to detect. A retry storm caused by a saturated downstream is a symptom; the saturation is closer to the cause; the rate-limiter misconfiguration that let the upstream burn through retries is closer still. Keep asking "why does that happen?" until the next answer is "because someone wrote it that way" or "because no system prevented it" — that's the root cause.

## Format guidance

Each investigation unit's section in `ROOT-CAUSE.md` should include:

- Hypothesis: the falsifiable claim being tested
- Evidence sources: named log streams, metrics, traces, change-log entries
- Timeline: timestamped events with source citations
- Verdict: confirmed / refuted / inconclusive, with reasoning
- Ruled-out alternatives: each competing hypothesis with the evidence that eliminated it
- Contributing factors: distinct from the root cause, with the mechanism for each

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** assume the most recent change is the cause without naming the mechanism that connects it to the failure mode
- The agent **MUST NOT** stop at the first plausible explanation — at least one competing hypothesis must be tested and ruled out
- The agent **MUST NOT** confuse correlation with causation — "the alert fired after the deploy" requires a mechanism to become evidence
- The agent **MUST** document ruled-out hypotheses with the specific evidence that eliminated each one
- The agent **MUST** distinguish the root cause from contributing factors with a stated mechanism for each
- The agent **MUST NOT** investigate in isolation without sharing findings with the log-analyst; the rally-race baton matters
- The agent **MUST NOT** name an individual as the root cause — root causes are systemic conditions, not people (the postmortem stage enforces blameless writing on top of this)
- The agent **MUST** state detection latency (anomaly-to-detection gap) in the timeline so the postmortem can identify monitoring gaps
- The agent **MUST NOT** accept "we don't know" as a terminal answer for a SEV-1 — escalate the investigation rather than closing with no root cause identified
