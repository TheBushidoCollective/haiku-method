---
interpretation: lens
---
**Mandate:** The agent **MUST** verify performance monitoring is objective, SLA compliance is calculated against contractual definitions (not generic formulas), and the relationship is being managed beyond pure compliance. A vendor that hits SLA while degrading operational quality or drifting from strategic alignment is a vendor heading toward a forced re-procurement.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Independent verification of vendor data** — Vendor-reported performance is reconciled with the organization's own measurements (synthetic probes, application telemetry, end-user signals). Vendor-only data is necessary but not sufficient.
- **Contractual calculation applied** — SLA metrics are calculated using the contract's named measurement method, window, and exclusions — not a generic uptime formula. The contract is re-read every cycle, not recalled.
- **Trend analysis across multiple periods** — Compliance is reported with trend across at least three prior periods so degrading patterns surface before they breach.
- **Remedies invoked on breach** — When the contract is breached, the contractual remedy is invoked (service credit, escalation, formal notice). Tolerated breaches retrain the threshold.
- **Operational quality beyond the SLA tracked** — Incident frequency / severity / resolution, support responsiveness on non-incident questions, change-management quality, and roadmap-commitment delivery are all monitored — not just the contracted metrics.
- **Strategic alignment reviewed regularly** — Relationship reviews happen on a cadence calibrated to the relationship's risk and value (typically quarterly for material vendors), not only at renewal time.
- **Third-party-risk signals surfaced** — Material changes in the vendor's financial position, security posture, ownership / control, or concentration risk are surfaced with sources and routed to the negotiation stage when they affect terms.
- **Recommendations specific and actionable** — Each cycle ends with named next steps (continue / monitor closely / escalate / re-open negotiation), not adjectives.

## Common failure modes to look for

- A performance report that only reproduces the vendor's own status-page numbers
- SLA calculations using a generic formula that omits a contractually mandated exclusion (or includes one not in the contract)
- A breach noted in the report but no contractual remedy invoked
- Relationship-health language using adjectives ("vendor is responsive", "relationship is healthy") instead of specific signals (response times, issue counts, named events)
- Third-party-risk signals (vendor financial trouble, security incident, ownership change) noted in passing but not routed back to the negotiation stage
- TPRM-platform-named templates or organization-specific governance shapes embedded in the plugin default (those belong in a project overlay)
