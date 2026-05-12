---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the close ties out: every adjusting entry is documented and standards-aligned, every balance-sheet account is reconciled to detail, every intercompany pair is eliminated, and the trial balance closes. A close that fails this lens leaks period-end errors into the next period and creates audit findings later.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Adjusting-entry documentation** — every adjusting entry cites its supporting documentation (contract, invoice, activity report, schedule) and names the policy basis (the applicable accounting standard or internal policy). Entries posted without documentation are unauditable.
- **Standards alignment** — revenue recognition and expense accruals follow the applicable standards (GAAP or IFRS as declared by the organization). Material judgments are documented with the policy rationale. Cut-off discipline is consistent across revenue, expense, and inventory / capex.
- **Reconciliation completeness at detail** — each balance-sheet account ties to its supporting schedule at line / transaction level, not just at summary. Differences above materiality have a named cause, owner, and resolution date.
- **Reconciling-item resolution paths** — items that don't clear in the period have a description, cause, owner, and expected resolution date. Items with no resolution path are a finding.
- **Intercompany elimination completeness** — every intercompany pair has booked the transaction on both sides at matching amounts, and the elimination entry references the matched pair. Un-eliminated intercompany balances gross up assets and liabilities and are a known fraud pattern.
- **Trial-balance tie** — debits equal credits, every account's ending balance equals beginning + period activity, and the closing balance equals the opening balance for the next period. Failure to tie is a hard-block finding.
- **Exception framework** — open exceptions are within the controller's stated tolerance, well-documented, and owned. Material unexplained exceptions block sign-off.

## Common failure modes to look for

- An accrual posted with no supporting documentation, only an assumption that the goods or services were received
- A reconciliation that ties in total but doesn't tie at the line / transaction level — coincidence, not reconciliation
- Reconciling items rolled forward from prior periods without resolution or re-classification
- Intercompany balances that don't agree across entities (timing differences misclassified as eliminations)
- Cut-off rules applied differently for revenue and cost of revenue in the same period — produces a mismatched margin
