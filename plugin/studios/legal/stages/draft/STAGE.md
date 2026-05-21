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

Translate the intake brief and the research memo into a concrete legal document — a contract, agreement, policy, exhibit, or filing. This is where the matter takes the form a counterparty will actually sign. The agent drafts; the licensed attorney owns the legal judgment, and every tactical choice is flagged for the attorney rather than decided here.

## Scope

Authoring the document's operative language: clauses, defined terms, cross-references, and exhibits that execute the brief and reflect the research. Draft decides *what the document says* — not whether the underlying analysis is sound (research), and not whether the finished document holds up (review). Tactical legal calls (an indemnity stance, a liability cap, choice of governing law) are surfaced to the attorney, not chosen.

## What to do

- Draft the operative clauses for the unit's scope, with defined terms and clean cross-references, mapping each protective clause to the risk it addresses.
- Keep defined-term usage, cross-references, exhibit completeness, and house style consistent across the document.
- Flag every tactical or judgment-laden choice for the attorney instead of resolving it silently.
- Trace the draft back to the brief and the memo so nothing in scope is left unaddressed.

## What NOT to do

- Don't make the legal-strategy calls — flag them; the attorney decides.
- Don't re-litigate the research or re-investigate the facts; consume the upstream memo and brief as given.
- Don't leave TODO markers, placeholders, or unresolved bracketed text in a draft you advance.
- Don't introduce terms the brief and research don't support.
