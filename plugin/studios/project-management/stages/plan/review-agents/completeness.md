---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the plan is operationally complete and traces back to the charter — every charter in-scope item is represented in the WBS, dependencies are explicit and consistent, estimates have ranges and methodology, and the critical path is identified. Gaps here surface in `track` as untracked work or unexplainable variance.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Charter trace** — every in-scope item from the charter is represented by at least one WBS work package. Any charter in-scope item without a corresponding work package is rejected.
- **Scope boundary preserved** — no WBS work package crosses an explicit charter out-of-scope boundary. Scope creep at planning time is the cheapest to catch.
- **Success-criteria coverage** — every charter success criterion has at least one work package whose completion contributes to meeting it.
- **WBS sizing** — work packages are sized within the studio's defaults (8-40 hours of effort) with explicit done conditions. Work packages too large to track or too small to coordinate are rejected.
- **Owner-and-capacity** — every work package has a single named owner with confirmed availability. Joint ownership, TBD ownership without a routing trigger, or owners with conflicting commitments are rejected.
- **Dependency completeness** — every work package has explicit predecessors and successors (or `none`). External dependencies have source, expected date, fallback, and escalation trigger.
- **Critical path identified** — the critical path is named explicitly, with each critical-path item carrying zero float and any contingency buffer justified.
- **Estimates with methodology** — every estimate has most-likely + range + confidence + method + assumptions. Single-point estimates without confidence range are rejected.
- **Contingency named separately** — contingency buffers are surfaced separately, not hidden inside estimate padding. Consumption authority is named.

## Common failure modes to look for

- A charter in-scope item that's been silently dropped from the WBS
- Work packages whose done condition is `"implementation complete"` or `"feature delivered"` rather than a named observable artifact or state
- A critical path that's never actually mentioned, only implied by the dependency graph
- External dependencies treated as if the project controls them (no fallback, no escalation trigger)
- Hidden padding inside estimates instead of a named contingency reserve with consumption rules
- High-uncertainty items (pessimistic / optimistic > 3×) not flagged for risk reduction
- "Joint ownership" or "team X" as owner instead of a single named role-holder
- A charter success criterion that no work package contributes to
- Estimates without documented methodology, leaving re-estimation later baseless
