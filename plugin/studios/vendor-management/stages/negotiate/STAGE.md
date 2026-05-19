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

Convert the selected vendor's evaluated position into agreed contractual terms — pricing, SLAs, exit provisions, data handling, liability, IP. The output is the master record of what the organization and the vendor agreed to; downstream stages execute against it.

## Per-unit baton

- `negotiator` → `legal-reviewer`: negotiated terms doc (commercial terms, SLAs with thresholds, exit / IP / data clauses).
- `legal-reviewer` → `verifier`: terms doc confirmed (or clause-level findings with recommended language).

## Inputs and outputs

`evaluate/vendor-scorecard` plus `requirements/rfp-document` feed in. The output is the negotiation terms document (`outputs/NEGOTIATION-TERMS.md`) — agreed commercial terms, SLAs with measurable thresholds, reviewed risk clauses — which feeds `onboard`.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, negotiator, feedback-assessor]` dispatches per finding — the classifier routes, the negotiator re-opens the affected terms with the vendor and updates the document, and the assessor independently decides closure. The gate is `external` — final signoff happens in the organization's external contracting / approval system (legal, finance, executive sponsor) and the engine waits for that approval signal before advancing. Project overlays may add organization-specific risk thresholds, industry-specific clause templates, or contract-lifecycle-management URLs without modifying the plugin defaults.
