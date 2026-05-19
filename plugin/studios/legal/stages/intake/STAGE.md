---
name: intake
description: Understand legal requirements and assess risk
hats: [paralegal, risk-assessor, verifier]
fix_hats: [classifier, paralegal, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
outputs:
  - discovery: legal-brief
    hat: paralegal
---

# Intake

Capture the matter before any drafting or research starts. Intake is a research-class stage: each unit corresponds to one knowledge surface (a party, a jurisdiction, a fact pattern, a risk category) that the rest of the studio will consume. The output is a `LEGAL-BRIEF.md` per unit plus the risk classification that downstream stages need to scope their work. **Nothing here is legal advice**; intake organizes facts and surfaces issues for the licensed attorney who owns the matter.

## Per-unit baton

- `paralegal` → `risk-assessor`: structured fact pattern slice of `LEGAL-BRIEF.md` (parties, jurisdictions, governing law, existing documents, sources cited).
- `risk-assessor` → `verifier`: risk-classified brief (regulatory / contractual / IP / dispute / reputational categories with mitigation options).

Process detail lives in each hat's md file — this stage enforces the chain, not the per-hat process.

## Inputs and outputs

Intake has no upstream stage. The frontmatter declares one output artifact — `LEGAL-BRIEF.md` per unit at intent scope — which feeds `research`, `draft`, `review`, and `execute`. Adding a new fact pattern or risk category means a new intake unit, not editing a completed one (forward-only per architecture §1.3).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, paralegal, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right unit; the paralegal re-authors the affected brief section; the assessor independently decides closure. The gate is `auto` — intake findings rarely require a separate approval step beyond verifier sign-off and the next-stage handoff. Project overlays at `.haiku/studios/legal/stages/intake/` may add house-style conventions (matter-number formats, conflict-check workflows, billing-code prefixes) without modifying the plugin defaults.
