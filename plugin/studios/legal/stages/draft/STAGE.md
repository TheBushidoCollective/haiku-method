---
name: draft
description: Create legal documents and contracts
hats: [drafter, editor, verifier]
fix_hats: [classifier, drafter, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: research
    discovery: research-memo
  - stage: intake
    discovery: legal-brief
outputs:
  - output: draft-document
    hat: drafter
---

# Draft

Translate the intake brief and the research memo into a concrete document — contract, agreement, policy, exhibit, or filing. Draft is a design-class stage: each unit corresponds to one drafted document or a discrete section of a larger document. The output is a `DRAFT-DOCUMENT.md` per unit that the review stage and the licensed attorney evaluate.

The agent is a drafting assistant; the licensed attorney owns the legal judgment. Anything that looks like a tactical choice (whether to accept a one-sided indemnification, what cap to put on a limitation of liability, which jurisdiction's law to choose for governing law) is **flagged for the attorney**, not decided by the agent.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`drafter`** (plan / do for clauses) — reads the brief and memo for this unit's scope, drafts the operative clauses with defined terms, and maps each protective clause back to the risk it addresses
- **`editor`** (do for consistency) — checks defined-term usage, cross-references, exhibit completeness, and house-style conventions across the draft
- **`verifier`** (verify) — confirms the draft is substantive (no TODO markers, no placeholders), traces back to inputs, and is internally consistent

## Inputs and outputs

The draft consumes `research/research-memo` and `intake/legal-brief`. It produces one `DRAFT-DOCUMENT.md` per unit, which feeds `review` and `execute`. Subsequent drafting iterations (a new clause, a counterparty's redline accepted into the body) become new units, not edits to the completed one.

## Fix loop and gate

`fix_hats: [classifier, drafter, feedback-assessor]` dispatches per finding. Classifier routes the FB to the right unit; drafter re-authors the affected clause; assessor closes. The gate is `ask` — the licensed attorney approves the draft locally before the review stage opens. Project overlays may add clause-library references, house numbering schemes, or specific document-platform conventions; the plugin default stays generic.
