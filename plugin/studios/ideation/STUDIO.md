---
name: ideation
description: Universal lifecycle for any creative or analytical work
stages: [research, create, review, deliver]
category: general
default_model: sonnet
---

# Ideation Studio

General-purpose lifecycle for creative, analytical, or exploratory work that doesn't fit a specialized domain. Works equally well for ideation proper (divergent generation, problem framing, concept selection) and for any deliverable that follows a `gather → make → critique → ship` arc — research memos, recommendation briefs, content pieces, How-Might-We slates, option-set explorations, analytical reports.

## Stage scope

- **`research`** — investigate the problem space. Build a defensible base of evidence the rest of the lifecycle stands on. Units are knowledge topics.
- **`create`** — produce the primary deliverable, grounded in research. Generate, narrow, articulate. Units are sections / components / concepts of the deliverable.
- **`review`** — adversarial quality pass. Plan the review, perform it, critique it, fact-check it. Units are review surfaces (clarity, evidence, novelty, audience fit, etc.).
- **`deliver`** — finalize and package for the target audience. Units are delivery actions (formatting, audience adaptation, packaging, publication step).

## Cross-cutting principles

- **Divergent then convergent.** Research and create both lean divergent first (cast a wide net, generate options, surface variants), then convergent (narrow with explicit criteria). The review stage compresses what survives; deliver ships it.
- **Cite or skip the claim.** Every non-trivial assertion ties back to a source — a URL, a quoted document, a dated stakeholder conversation, a recorded Decision. Unsourced claims are how confident-sounding nonsense leaks into the final deliverable.
- **The deliverable is the contract.** Whatever the intent calls for (memo, slate of concepts, recommendation, report) is the work product. Stages don't optimize for their own internal beauty — they optimize for the deliverable that ships at the end of `deliver`.
- **Substance before polish.** `create` produces a draft worth critiquing. `review` finds what's wrong. `deliver` polishes only what survived review.

## Project overlays

Plugin defaults stay tool-agnostic. Teams that publish through a specific docs platform (Confluence, Notion, an internal wiki), use a specific ideation tool, or have a house style guide should put those conventions in a project overlay at `.haiku/studios/ideation/...` — never in the plugin defaults.
