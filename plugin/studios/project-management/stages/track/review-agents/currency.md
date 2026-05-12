---
interpretation: lens
---
**Mandate:** The agent **MUST** verify tracking data is current, evidence-backed, and complete — variance has specific causes, mitigations have execution evidence, and open items have owners and concrete dates. Stale data carried forward as if current is the most common failure mode; this lens exists to catch it.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Data currency** — every active work package, issue, and risk has an as-of timestamp within the current tracking cycle. Stale data carried forward without a re-confirmation note is rejected.
- **Evidence-backed actuals** — every work-package status is supported by a concrete artifact or system signal (PR, ticket state, test result, monitoring graph, demonstrated behavior), not just an owner's self-report. Self-reports without corroboration are rejected.
- **Specific variance causes** — every work package with ≥ 10% variance on any axis has a specific named cause (what changed, what's being done, when it unblocks). Generic causes (`"unforeseen complexity"`, `"resource constraints"`) are rejected.
- **Issue completeness** — every issue has ID, owner, target resolution date, escalation trigger, and current status. Joint ownership, "soon" / "ASAP" dates, or absent escalation triggers are rejected.
- **Risk-register currency** — every risk has been reassessed this cycle (changed or re-confirmed). Risks silently carried forward without re-assessment are rejected.
- **Mitigation execution evidence** — every active mitigation cites observable execution (work package, ticket, recurring check-in, monitoring dashboard). Documented-but-not-executing mitigations are rejected — they're false confidence.
- **Trigger monitoring** — every risk with a numeric or event trigger has the current value vs. threshold and trajectory recorded.
- **No silent escalations** — a trigger that activated without mitigation kick-off is surfaced explicitly, not papered over.

## Common failure modes to look for

- A status report dated for this cycle whose underlying data points are all from prior cycles
- "75% complete" with no artifact or evidence to corroborate
- Variance causes that read like apologies (`"taking longer than expected"`) rather than diagnoses
- Issues whose owner is `"team X"` or `"engineering"` instead of a named role-holder
- Issues whose target date is `"end of sprint"` or `"by EOM"` instead of a concrete date
- Mitigations in the register that were entered three cycles ago and have no execution evidence
- Risks whose probability or impact hasn't been reassessed since the project kickoff
- An issue or risk that's been transferred or accepted without recorded sponsor acknowledgment
- A summary that says "all green" while the detail shows ≥ 10% variance on multiple work packages
