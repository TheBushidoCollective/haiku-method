---
name: research
description: Research precedent and review regulatory requirements
hats: [researcher, analyst, verifier]
fix_hats: [classifier, researcher, analyst, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: intake
    discovery: legal-brief
outputs:
  - discovery: research-memo
    hat: analyst
---

# Research

Take the intake brief and produce a structured research memo per knowledge topic. Research is a research-class stage: each unit corresponds to one investigable question — a specific regulatory regime, a contract-term pattern, a recent enforcement action, a comparable precedent. The output is a `RESEARCH-MEMO.md` per unit that the draft stage and the responsible attorney will consume when shaping the document.

This stage gathers and summarizes legal materials. It does NOT render legal opinions or strategy. Conclusions presented as "the law requires X" must cite the primary source and must be reviewed by a licensed attorney before any action.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`researcher`** (plan / do for gathering) — identifies the relevant primary and secondary sources for the unit's topic, captures the citation, and surfaces what's settled vs. what's contested
- **`analyst`** (do for synthesis) — turns raw findings into the structured memo: applicable rules, key precedent or guidance, open questions, and a recommendation for the attorney's review (NOT for execution)
- **`verifier`** (verify) — confirms citations are real and current, sources are authoritative, and the analysis traces back to the intake brief

## Inputs and outputs

Frontmatter declares `intake/legal-brief` as input and one output: `RESEARCH-MEMO.md` per unit at intent scope. The memo feeds `draft`, `review`, and `execute`. New research topics get new units; completed memos are immutable.

## Fix loop and gate

`fix_hats: [classifier, researcher, analyst, feedback-assessor]` dispatches per finding. Classifier routes; `researcher` re-frames a finding about scope or direction, and `analyst` re-authors the affected memo section (the memo is the analyst's artifact — a corrected citation, an added jurisdictional consideration); assessor closes. Both implementers are in the chain so a finding lands with the hat that owns the flagged artifact. The gate is `auto`. The licensed attorney is the gate for legal judgment — the workflow's `auto` advance only means the artifact is internally well-formed.
