---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the draft uses defined terms with discipline, cross-references that resolve, and language precise enough that two readers reach the same interpretation. Ambiguity in legal drafting becomes ambiguity in performance, which becomes disputes. Every clause must trace to a brief requirement or risk-inventory entry.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Defined-term discipline** — every Capitalized Term used in operative provisions is defined; every defined term is used; case is consistent (`Confidential Information` everywhere, never `confidential information`); no shadow definitions (one term defined two different ways).
- **Cross-references resolve** — every `Section X.Y`, `Exhibit Z`, `Schedule N` reference points to a section or attachment that exists with content. No `[TBD]`, `[INSERT]`, or empty placeholder remains.
- **Brief-to-clause traceability** — every requirement in `LEGAL-BRIEF.md` has a corresponding provision in the draft. Missing requirements are critical findings.
- **Risk-to-clause traceability** — every protective clause maps to a specific risk in the brief's risk inventory. Clauses without a triggering risk are flagged for attorney confirmation (they may be necessary, but the trace should be explicit).
- **Operative ambiguity is bounded** — qualifying terms like `reasonable`, `material`, `from time to time`, `in good faith` are either defined or used in contexts where the surrounding language scopes them. Unbounded subjective standards are findings.
- **Recitals are recital-shaped** — recitals state context, not obligations. An operative obligation buried in a recital is a finding (the clause won't carry the intended legal effect).
- **Boilerplate is appropriate** — every boilerplate provision (severability, entire agreement, amendments, notices) is appropriate for the document type and jurisdiction. Generic boilerplate that conflicts with the matter is a finding.

## Common failure modes to look for

- A term used before its definition (capitalized usage in §2 with the definition in §5)
- A definition that doesn't match how the term is used in operative provisions
- An exhibit referenced but not attached
- A cross-reference to a renumbered section that wasn't updated
- A clause that addresses no risk and no requirement (deadweight)
- A risk in the inventory with no addressing clause
- "Reasonable best efforts" used without a defined standard for what's reasonable
- Recitals that include obligations ("The Parties shall ...") instead of context ("The Parties wish to ...")
- A template's boilerplate carried over to a document type it doesn't fit
