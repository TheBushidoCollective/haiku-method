---
name: research
description: Identify target audience, map the topic landscape, analyze competitive content
hats: [audience-analyst, topic-scout, verifier]
fix_hats: [classifier, audience-analyst, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
outputs:
  - discovery: audience-landscape
    hat: audience-analyst
---

# Research

Research is the inception-class stage of the dev-evangelism lifecycle. It takes the user's evangelism intent ("we want to publish content about X to reach developer audience Y") and turns it into a structured map of who the audience actually is, what topics they care about, where they hang out, and where the team has credible expertise to contribute. Every downstream stage — narrative, create, publish, measure — reads this output.

## Per-unit baton

Units here are **knowledge topics**, not execution tasks. Each unit walks the three hats in `plan → do → verify` order:

- **`audience-analyst`** (plan) reads any prior community signals, prior content history, and the intent's stated audience hypothesis, then maps developer segments, skill levels, and platform behavior for this topic
- **`topic-scout`** (do) consumes the audience map and produces the topic landscape — trending threads, underserved gaps, competitive content, team-credibility check
- **`verifier`** (verify) validates the resulting knowledge artifact against substance / citation / consistency rules and advances or rejects to the responsible hat

The baton across the rally race is the audience-and-topic understanding accumulating on disk in the unit body, plus the shared intent-scope `AUDIENCE-LANDSCAPE.md` knowledge artifact.

## Inputs and outputs

The frontmatter declares no upstream inputs — research is the entry stage. The output is the intent-scope `AUDIENCE-LANDSCAPE.md` knowledge artifact, which downstream stages consume as their grounding for who they're writing for and what they're writing about.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, audience-analyst, feedback-assessor]` dispatches per finding. Classifier routes the FB to the right unit; `audience-analyst` is the implementer (re-authoring the audience or topic claim); the assessor independently decides closure. The gate is `auto` — research is upstream of any creative decisions, so the workflow advances without a user gate unless review surfaces a finding.
