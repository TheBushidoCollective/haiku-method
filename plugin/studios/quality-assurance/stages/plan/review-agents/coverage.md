---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the test strategy and plan provide adequate, risk-justified coverage across every quality dimension that applies — and that gaps are surfaced as explicit choices, not silences.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Scope completeness** — In-scope and out-of-scope are both enumerated. Every product area mentioned in the intent appears in one of the two lists. Silence on an area is a coverage gap, not a default.
- **Risk-based prioritization is honest** — The risk table's scores reflect business impact and failure probability, not personal interest or test convenience. Any high-impact area scored low needs an explicit rationale.
- **Quality dimensions are explicit per area** — Functional, integration, regression, performance, accessibility, security smoke, compatibility, usability. For each in-scope area, every applicable dimension is either claimed (with depth) or excluded (with reason).
- **Entry and exit criteria are measurable** — Every exit criterion has a specific threshold (count, percentage, severity band). Reject any criterion that reads as `"acceptable"`, `"sufficient"`, `"reasonable"` without a number behind it.
- **Resource and environment feasibility** — Resources and environments named in the planner section are achievable within the stated constraints, or the constraint is escalated.
- **Coverage targets are linked to risk** — High-priority areas get exhaustive coverage; low-priority get smoke. The plan does NOT spend equal depth on every area regardless of risk.

## Common failure modes to look for

- An out-of-scope list that's empty or missing — every team has out-of-scope; an empty list means the author hasn't thought about it
- Exit criteria like `"quality is acceptable"`, `"sufficient coverage"`, `"team is comfortable releasing"` — these are vibes, not gates
- A risk table where everything is High or everything is Medium — risk should differentiate
- A regulated-data area without an explicit data-handling note
- Quality dimensions silently omitted (accessibility, security smoke) without a reason
- A schedule expressed in calendar dates that conflicts with the dependency DAG
- The same severity / priority taxonomy used inconsistently across sibling units
