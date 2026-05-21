---
name: investigate
description: Root cause analysis, log analysis, and timeline reconstruction
hats: [investigator, log-analyst, verifier]
fix_hats: [classifier, investigator, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: triage
    discovery: incident-brief
---

# Investigate

Take the confirmed incident brief from triage and answer two questions: what is the actual root cause, and what is the full timeline from first anomaly to detection. Investigation runs in parallel with mitigation — chasing the cause doesn't wait for the bleeding to stop. The diagnosis this stage produces feeds the permanent fix and the postmortem story.

## Scope

Diagnosis: the root cause, the timeline, the ruled-out hypotheses, and the contributing factors. Investigate decides *why the incident happened* — not how bad it is (triage), how to stop the impact (mitigate), or how to fix it permanently (resolve). It explains the failure; it doesn't act on it.

## What to do

- Form falsifiable hypotheses with named evidence sources, then test them — distinguish root cause from proximate trigger.
- Pull logs, metrics, and traces from the named sources and correlate timestamps across systems.
- Reconstruct the timeline from first anomaly to detection, explaining any gaps rather than glossing them.
- Rule out competing hypotheses with evidence, not assertion.

## What NOT to do

- Don't apply mitigations or build the permanent fix — that's mitigate and resolve.
- Don't redo triage's severity or ownership calls; consume the brief as the starting point.
- Don't name a root cause that's really just the proximate trigger.
- Don't leave a competing hypothesis open without the evidence that closes it.
