---
interpretation: strict
---
**Mandate:** The agent **MUST** verify execution formalities are correct for the document type and jurisdictions involved, conditions precedent are confirmed, the change log is complete, and the retention record is indexed for findability. A failure at this lens is a defect in the executed record — discoverable later in audits, renewals, and disputes.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Every review finding is resolved** — critical and important findings are either incorporated into the body (with a change-log entry), formally negotiated with the counterparty (with the negotiated language in the body and rationale recorded), or formally waived by the licensed attorney (with the waiver rationale recorded). No open findings remain.
- **Change log is complete** — every modification from the approved draft to the executed copy has a change-log entry naming the source finding, the affected provision, the description of the change, and the attorney approval reference.
- **Conditions precedent are confirmed** — every condition precedent the document or the matter requires is checked off, with a reference to the confirming evidence (board minute, attorney confirmation, counterparty representation, etc.).
- **Execution formalities are correct** — signing authority is confirmed for both sides, witness / notarization / apostille / consular legalization requirements are satisfied (where applicable), and the chosen execution method (original counterparts, electronic execution) is acceptable for this document type and jurisdiction. Where the attorney is the authority on a specific formality, the confirmation is recorded.
- **Retention record is indexed** — the document is filed with the correct matter ID, party identification, governing-law / venue, term / expiration, related-document references, and access controls. The retention record matches the org's repository schema (not a plugin-default schema).
- **Version history is preserved** — every meaningful version (initial draft, edits, review, approved draft, executed) is preserved with its date and source. Counterparty redlines (if any) are preserved per round.
- **Key dates are recorded** — term, expiration, auto-renewal trigger and notice window, termination-for-convenience notice period, compliance deadlines, milestones, insurance renewals — each with the action required when the date arrives.

## Common failure modes to look for

- Body changes made during finalization without a corresponding change-log entry
- A condition precedent marked confirmed without a reference to the confirming evidence
- Signing authority assumed rather than confirmed (a signer's title doesn't always carry the necessary authority)
- An electronic execution used where the document type or jurisdiction requires original counterparts
- The retention record indexed under the wrong matter ID or with a party's common name instead of legal name
- Auto-renewal date recorded without the notice window required to prevent it
- A "no open findings" assertion when a finding's required change wasn't actually made
- Cross-jurisdictional notarization / legalization requirements skipped because the formalities of one jurisdiction were assumed sufficient for both
