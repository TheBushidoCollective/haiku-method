---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the certification determination is evidence-based, traceable to the strategy's exit criteria, and audit-ready. An external sign-off body or auditor reading the record without prior context should be able to follow every claim to its source.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Exit-criterion completeness** — Every exit criterion from the strategy is evaluated in the certifier's assessment table. Silent omissions are findings.
- **Evidence specificity** — Every MET / PARTIAL / NOT-MET assessment cites specific evidence (case IDs, defect IDs, metric paths), not summary statements.
- **Risk-acceptance traceability** — Every known issue has a risk-acceptance status. Signed-by claims name the role; the role matches the accountability tier the strategy or recorded Decisions assign for that issue class.
- **Determination consistency** — The CERTIFY / CERTIFY-WITH-KNOWN-ISSUES / DEFER / BLOCK determination follows from the counts (NOT-MET, PARTIAL, open severity bands, unaccepted issues) per the rules in the certifier's mandate.
- **Coverage across quality dimensions** — The certification reflects functional, performance, security smoke, accessibility, regression, compatibility, and any other dimension the strategy declared in-scope. Silently dropping a dimension is a finding.
- **Threshold honesty** — No exit-criterion threshold has been re-interpreted or relaxed without escalation. The threshold in the certifier section matches the strategy verbatim.
- **Audit references** — The determination block includes pointers back to strategy, quality report, and test-results sections it relies on. A future auditor can replay the chain.
- **Reviewer independence visible** — The `reviewer` hat's validation is in the record; advance / reject was on substance, not deference.

## Common failure modes to look for

- A `CERTIFY` determination with an open P1 defect that doesn't appear in the known-issues list
- A `MET` assessment whose cited evidence actually shows the threshold not met
- A risk acceptance "signed by product owner" for a security finding that should require security lead sign-off
- A PARTIAL assessment that hides a real NOT-MET because the certifier didn't want to escalate
- Quality dimensions claimed in scope by the strategy but missing from the assessment table (no accessibility check, no regression check)
- Determination rationale that summarizes without citing — "all criteria are well-covered" instead of "criteria 1–7 MET per test-results slice 02, criterion 8 PARTIAL per quality-report finding F-3"
- A DEFER recommendation with no specific gap-to-close list
- A BLOCK determination with no named structural issue
- Rationale that contradicts a recorded Decision without citing the Decision ID
- A strategy threshold silently relaxed in the assessment ("zero P1" became "low P1 count is acceptable")
