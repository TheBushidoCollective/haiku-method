---
name: negotiate
description: Negotiate terms and review contract provisions
hats: [negotiator, legal-reviewer, verifier]
fix_hats: [classifier, negotiator, feedback-assessor]
review: external
elaboration: collaborative
inputs:
  - stage: evaluate
    discovery: vendor-scorecard
  - stage: requirements
    discovery: rfp-document
---

# Negotiate

Convert the selected vendor's evaluated position into agreed contractual terms — pricing, SLAs, exit provisions, data handling, liability, IP. The output is the master record of what the organization and the vendor agreed to; the downstream stages execute against it.

## Scope

Term negotiation and risk review: settling commercial terms, defining SLAs with measurable thresholds, and reviewing the risk clauses (exit, IP, data, liability) for legal and commercial exposure. Negotiate decides *what both parties commit to* — not which vendor was chosen (evaluate) or standing the relationship up operationally (onboard).

## What to do

- Negotiate commercial terms and SLAs with measurable thresholds, not aspirational language no one can enforce.
- Review risk clauses (exit, IP, data, liability) and categorize each by legal vs commercial exposure with recommended language.
- Keep the terms document authoritative — onboard and monitor compare against exactly what's recorded here.
- Surface non-standard terms for the right approval authority rather than absorbing them quietly.

## What NOT to do

- Don't re-score or re-shortlist vendors — a flawed selection is a revisit to evaluate.
- Don't provision accounts or wire integrations; that's onboard.
- Don't agree to an SLA without a measurable threshold behind it.
- Don't leave a negotiated term out of the master record that downstream stages depend on.
