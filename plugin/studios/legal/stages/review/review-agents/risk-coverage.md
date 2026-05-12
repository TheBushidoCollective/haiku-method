---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify every risk in the intake risk inventory is either addressed by a specific protective provision or documented as accepted by the attorney, and every applicable compliance requirement maps to a specific provision. Coverage gaps here become deal exposure or regulatory exposure after execution. This lens is the last line of defense before the licensed attorney sees the document.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Risk-to-provision mapping is complete** — every risk in `LEGAL-BRIEF.md`'s risk inventory has either a protective provision in the draft or an explicit risk-acceptance entry in the review findings with attorney sign-off recorded.
- **Compliance-to-provision mapping is complete** — every regulatory requirement from the research memo (and from the compliance-officer hat's findings) maps to a specific provision or has a documented basis for non-applicability (an exemption, a structural avoidance) with primary-source support.
- **Findings are severity-tagged correctly** — critical findings affect the deal substance (exposure, breach of brief, regulatory violation). Important findings affect posture but not deal viability. Advisory findings are clarity / consistency. Misclassified severity creates downstream prioritization errors.
- **Remediation options are real** — every finding's remediation options are specific enough that the closer hat can implement them or the attorney can evaluate the trade-off. "Improve the clause" is not a remediation option.
- **Open findings block execution** — no critical or important finding is left unresolved at the gate. A critical finding that's still open is a critical gap in the review itself.
- **Recent developments are accounted for** — the research memo's `## Recent developments` is reflected in the review. If a regulatory regime changed and the draft doesn't address the change, that's a critical finding.

## Common failure modes to look for

- A risk in the inventory with no addressing provision and no documented acceptance
- A regulatory requirement cited in the research memo with no matching provision and no exemption rationale
- A "critical" finding tag attached to a stylistic preference (misclassification)
- An "advisory" tag on a finding that's actually deal-affecting
- Remediation framed as a single instruction ("change §11.4 to X") rather than as options the attorney can evaluate
- An open finding the reviewer didn't realize was open (a finding marked resolved without the corresponding provision change)
- A risk in the inventory the reviewer didn't notice because it was tagged "low / low" and skipped silently
- A regulatory change in the recent-developments section that the draft predates
