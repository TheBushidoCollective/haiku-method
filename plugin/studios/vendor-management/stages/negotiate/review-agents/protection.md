---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the negotiated terms adequately protect the organization's interests across the full life of the contract, not just at signing. Gaps here become unbounded exposure later — operational, financial, regulatory, reputational.

## Check

The agent **MUST** verify, file feedback for any violation:

- **SLA thresholds with measurement and remedies** — Every SLA term includes a measurable threshold, a named measurement method, an exclusion list with rationale, and a real remedy (service credit ladder, escalation, termination right after sustained breach). SLA language without remedies is marketing, not contract.
- **Exit provisions adequate** — The contract names data export format and timeline, data deletion with attestation, transition assistance, and either a termination-for-convenience right or a clearly bounded set of termination-for-cause triggers. Vendor lock-in disguised as a long contract is reject-worthy.
- **Data handling and privacy compliant** — Data classification, residency, retention, deletion, breach notification, subprocessor consent, and cross-border transfer mechanisms are addressed and align with the applicable regulatory regime.
- **Material risk clauses reviewed** — Liability caps, indemnification scope, IP ownership (including data and any derivative work), confidentiality, audit rights all have either acceptable language or documented risk acceptance with named owner.
- **Renewal mechanics fair** — Auto-renewal (if present) has an explicit notice window and a price-cap on renewal. Open-ended renewal escalators are reject-worthy.
- **Trade-offs documented** — Each concession is named with what was traded for it; silent concessions leak value.

## Common failure modes to look for

- An SLA section that uses adjectives ("high availability", "responsive support") instead of measurable thresholds
- An SLA with thresholds but no remedy, or a remedy capped so low it doesn't change vendor behavior
- An auto-renew clause with a 90-day notice window that the contract administrator won't catch in time
- Liability capped at the annual contract value when the realistic breach-cost exposure is many times higher
- IP ownership language that grants the vendor broader rights to your data than the use case requires
- "Risk-accepted" entries with no named owner and no compensating control
- Contract-platform-specific templates or jurisdiction-specific framework details embedded in the plugin default (those belong in a project overlay)
