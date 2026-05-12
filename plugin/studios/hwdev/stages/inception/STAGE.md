---
name: inception
description: Market research, user problem, and business case
hats: [researcher, distiller, verifier]
fix_hats: [classifier, researcher, feedback-assessor]
review: ask
elaboration: collaborative
inputs: []
---

# Inception

Understand the market, user problem, and business case for the hardware
product. Same shape as application-development inception — what are we
building and why, who would buy it, what is the competitive landscape, what
is the unit-economics envelope. Hardware-specific constraints (safety,
regulatory frameworks, manufacturing feasibility, environmental envelope)
are NOT decided here; they surface in the `requirements` stage. Inception
identifies *which markets and product class* matter so requirements knows
what regulatory and safety frameworks to plan against.

## Per-unit baton

Each inception unit walks `plan → do → verify`:

- **`researcher`** (plan) frames an investigable knowledge topic, gathers
  raw findings from primary and secondary sources, and records citations
  inline.
- **`distiller`** (do) turns raw findings into a structured, decision-ready
  knowledge artifact — segments named, alternatives priced, gaps articulated.
- **`verifier`** (verify) checks the artifact for substance, citation,
  internal consistency, and decision-register accountability — body-only,
  no frontmatter interpretation.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, researcher,
feedback-assessor]` dispatches per finding: the classifier routes the
finding to the right unit or stage; the researcher re-investigates and
edits the FB body with diagnosis; the assessor independently decides
closure. The gate is `ask` — a local human review through the review UI
is enough for market / business-case sign-off in most cases. Projects that
want external review (executive signoff, board review) override the gate
to `[external, ask]` in a project overlay.
