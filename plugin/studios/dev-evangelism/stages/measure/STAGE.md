---
name: measure
description: Track engagement, gather feedback, identify follow-up opportunities
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

Measure is the validation / certification stage of the dev-evangelism lifecycle. It closes the loop: actuals vs. targets per channel, qualitative feedback synthesized from community responses, and a prioritized set of follow-up recommendations for the next intent.

Measure is also where vanity metrics die. Impressions and likes without a connection to a meaningful outcome (signups, doc visits, code-sample copies, conference invites, recurring readership) are noise. The analyst's job is to filter noise; the feedback-synthesizer's job is to surface the qualitative signal alongside it.

## Per-unit baton

Units here are **measurement surfaces** (one per channel cluster or per audience segment, depending on the intent's reporting structure). Each unit walks the three hats in `plan → do → verify` order:

- **`analyst`** (plan / do for the quantitative side) reads the distribution log, pulls engagement data per channel, compares actuals to targets, and identifies drivers of over- and under-performance
- **`feedback-synthesizer`** (do for the qualitative side) gathers community comments / replies / DMs, categorizes themes, preserves representative quotes, and flags misunderstandings the content should have prevented
- **`verifier`** (verify) validates the impact analysis against data-grounded / target-comparison / quote-backed rules and advances or rejects to the responsible hat

The baton: distribution log → quantitative impact analysis with channel drivers (analyst) → qualitative themes with representative quotes (feedback-synthesizer) → validated impact report with prioritized follow-ups (verifier).

## Inputs and outputs

Upstream `publish/distribution-log` feeds in. The output is the intent-scope `IMPACT-REPORT.md` containing engagement deltas, audience analysis, feedback synthesis, and prioritized follow-up recommendations that will seed the next dev-evangelism intent.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, analyst, feedback-assessor]` dispatches per finding. The gate is `auto` — measure is the last stage and the intent-completion review (if enabled) is the human-facing checkpoint, so the stage advances on its own once the verifier confirms the report is data-grounded.
