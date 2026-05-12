---
name: negotiate
description: Negotiate terms and review contract provisions
hats: [negotiator, legal-reviewer]
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

Each unit walks the hat chain in order:

- **`negotiator`** (plan / do) negotiates commercial terms, defines SLA thresholds and remedies, and documents agreed pricing, payment, duration, renewal, and exit terms with comparison to the initial position
- **`legal-reviewer`** (verify lens) reviews material risk clauses (liability, indemnification, IP ownership, data handling), verifies regulatory compliance (data privacy, industry-specific regulations), and either confirms terms or recommends specific contract language modifications

The baton is the negotiated terms document. The legal reviewer either confirms the terms stand or files findings naming the exact clauses that need rework, with recommended language.

## Inputs and outputs

`evaluate/vendor-scorecard` plus `requirements/rfp-document` feed in. The output is the negotiation terms document (`outputs/NEGOTIATION-TERMS.md`) — agreed commercial terms, SLAs with measurable thresholds, reviewed risk clauses — which feeds `onboard`.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, negotiator, feedback-assessor]` dispatches per finding — the classifier routes, the negotiator re-opens the affected terms with the vendor and updates the document, and the assessor independently decides closure. The gate is `external` — final signoff happens in the organization's external contracting / approval system (legal, finance, executive sponsor) and the engine waits for that approval signal before advancing. Project overlays may add organization-specific risk thresholds, industry-specific clause templates, or contract-lifecycle-management URLs without modifying the plugin defaults.
