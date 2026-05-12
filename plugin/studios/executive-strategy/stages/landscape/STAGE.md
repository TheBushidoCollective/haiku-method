---
name: landscape
description: Analyze market conditions, competitive intelligence, and strategic context
hats: [strategist, analyst, verifier]
fix_hats: [classifier, strategist, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
---

# Landscape

The opening stage of the executive-strategy lifecycle. Take the strategic question the user landed with and build the shared picture of the world it has to be decided in: market forces, competitor moves, regulatory pressure, organizational capability, and the uncertainties that matter most. Downstream stages (`options`, `evaluate`, `decide`) cannot do useful work if this picture is missing or wrong.

Units in this stage are **knowledge topics** — one investigable surface per unit (e.g. "regulatory environment", "competitive positioning", "internal capability"). The stage produces the intent-scope `LANDSCAPE-ANALYSIS.md` synthesizing all topics into one coherent view.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`strategist`** (plan) frames the topic, defines scope, and names the questions the analysis must answer
- **`analyst`** (do) gathers and validates the evidence — market data, competitor moves, capability signals
- **`verifier`** (verify) checks substance, citation, internal consistency, and decision-register accountability

Detailed process lives in each hat's md file.

## Inputs and outputs

No upstream inputs — this is stage zero. The output `LANDSCAPE-ANALYSIS.md` feeds `options` and `evaluate`. Frameworks like SWOT, Porter's Five Forces, and PESTEL are legitimate generic structuring devices; use them as concepts, not as a checklist that forces every topic to fit.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, strategist, feedback-assessor]` dispatches per finding — the classifier targets the FB, the strategist re-frames or re-sources, and the assessor independently decides closure. The gate is `auto` — once verifier hats advance and review agents are clean, the workflow engine moves on without human approval. Project overlays at `.haiku/studios/executive-strategy/stages/landscape/` may add house-style conventions (org-specific framing language, decision-register format, citation style) without modifying the plugin defaults.
