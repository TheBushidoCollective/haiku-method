---
name: measure
description: Track engagement, gather feedback, identify follow-up opportunities
optional: true
hats: [analyst, feedback-synthesizer, verifier]
fix_hats: [classifier, analyst, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: publish
    discovery: distribution-log
outputs:
  - discovery: impact-report
    hat: analyst
---

# Measure

The terminal stage of the dev-evangelism lifecycle: close the loop. Compare actuals to targets per channel, synthesize the qualitative feedback from community responses, and produce the prioritized follow-ups that seed the next intent.

## Scope

Reading impact and recommending what comes next — quantitative deltas joined to qualitative themes. Measure decides *what the content actually achieved and what to do next* — it does not produce or republish content (create, publish). This is where vanity metrics die: impressions and likes with no connection to a meaningful outcome are noise.

## What to do

- Pull engagement per channel, compare actuals to targets, and name the drivers of over- and under-performance.
- Filter vanity metrics out; keep what connects to a real outcome — signups, doc visits, code-sample copies, invites, recurring readership.
- Gather community comments and replies, categorize the themes, and preserve representative quotes.
- Ground every follow-up recommendation in both the numbers and the audience's own words.

## What NOT to do

- Don't produce, edit, or republish content — that's the create and publish stages.
- Don't report a metric you can't tie to a meaningful outcome.
- Don't synthesize feedback without keeping the representative quotes that back it.
- Don't hand off follow-ups that aren't prioritized.
