---
name: review
description: Adversarial quality review of the deliverable
hats: [review-planner, synthesizer, reviewer, critic, fact-checker]
fix_hats: [classifier, synthesizer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: create
    discovery: draft-deliverable
---

# Review

Adversarially stress-test the deliverable before it's finalized. The draft from create goes in; a structured report with severity-graded findings comes out. This stage exists to surface the weaknesses, unsupported claims, and gaps the author couldn't see in their own work.

## Scope

Quality review of the draft against named criteria: each review surface — clarity, evidence strength, novelty, structural integrity, scope fit, audience fit, coherence — examined and graded. Review decides *whether the deliverable holds up and where it doesn't* — not what it says (create) and not how it's packaged (deliver). It produces findings; it doesn't rewrite the artifact.

## What to do

- Name each review surface and its criteria, then review against them with cited observations.
- Trace every claim in the draft to its source and flag anything that doesn't trace.
- Hunt for weaknesses, logical gaps, and missing perspectives the author wouldn't catch on their own work.
- Grade findings by severity (critical, major, minor) so the next stage knows what must be addressed.

## What NOT to do

- Don't rewrite the deliverable or fix the findings yourself — record them; addressing them is a revisit to create.
- Don't re-run research or generate new content.
- Don't soften a finding because the draft is otherwise good; severity discipline is the point.
- Don't decide unilaterally which findings get addressed — a human arbitrates that before deliver.
