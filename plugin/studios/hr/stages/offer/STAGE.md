---
name: offer
description: Develop compensation package and extend offer
hats: [compensator, closer, verifier]
fix_hats: [classifier, compensator, feedback-assessor]
review: external
elaboration: collaborative
inputs:
  - stage: interview
    discovery: interview-scorecard
  - stage: requisition
    discovery: job-spec
---

# Offer

Convert the interview stage's hire recommendation into a competitive, equitable, and approved compensation package, and manage the offer through to candidate response. Offer is the terminal stage of the hiring lifecycle — small errors here (a misaligned comp band, a missing approval, a verbal commitment that doesn't match the written offer) lose the candidate or create downstream pay-equity and policy problems.

## Per-unit baton

Each unit (a single offer for a specific candidate) walks the three hats in `plan → do → verify` order:

- **`compensator`** (plan) reads the interview signal and the candidate's compensation context, builds the package against external market data and internal equity bands, documents the positioning rationale
- **`closer`** (do) prepares the complete offer documentation, drives the approval workflow, manages negotiation within approved parameters, runs the candidate communication, and maintains a contingency plan
- **`verifier`** (verify) validates the offer record for substance, completeness, and approval-trail integrity — advances or rejects

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

Upstream inputs are `requisition/job-spec` (compensation envelope, seniority calibration, business case) and `interview/interview-scorecard` (hire recommendation, panel rationale, seniority-calibration signal from the panel). The single output is `OFFER-PACKAGE.md` at intent scope — the compensation analysis, the offer letter, the negotiation parameters, the contingency plan, and the approval record.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, compensator, feedback-assessor]` dispatches per finding. The classifier routes; the compensator re-authors the affected sections (a closer-only fix often misses the underlying comp framing); the assessor decides closure.

The gate is `external` — the offer must clear out-of-process approval (finance, legal, executive sponsor depending on level) before extension. The plugin default delegates to whatever external approval system the team uses; project overlays can name the specific platform.

Sensitive topic note: offer-stage work intersects with pay-equity law, pay-transparency rules, equity-grant compliance, immigration / work-authorization concerns, and jurisdiction-specific employment law. The equity review agent looks for fairness patterns; where findings touch any of these surfaces, defer to human review and, where applicable, jurisdictional employment and tax counsel — the plugin does not dispense legal interpretations.
