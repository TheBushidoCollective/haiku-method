---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the roadmap is achievable given dependencies, capacity, and external constraints. A roadmap that survives this lens can be defended to stakeholders without retreat; a roadmap that doesn't gets unwound at the first incident or external slip.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Dependency sequencing** — The order respects hard technical dependencies. Items appear after the work they depend on, not before. Dependency-direction errors are findings to file.
- **External-dependency realism** — Partner deliveries, regulatory approvals, third-party releases, and contractual cutover dates have realistic lead times with buffer. "Assumed ready by milestone N" without a citation is a finding to file.
- **Capacity headroom** — The roadmap plans to at most ~80% of available capacity to absorb unplanned work, incidents, and learning curves. 100%-utilization plans are findings to file.
- **Critical-path collisions** — No single team member or thin skill area is on the critical path for multiple concurrent initiatives. Where collisions exist, the roadmap names a mitigation.
- **Milestone completion criteria** — Every milestone has measurable, verifiable completion criteria in the framing's chosen idiom (outcomes, deliverables, etc.). "Milestone N is done when N-related work is done" is circular and a finding to file.
- **Risk and assumption surfacing** — Risks and assumptions that could move the roadmap are named explicitly. A roadmap that reads as if every assumption will hold is a roadmap that has hidden its risks.
- **Strategic narrative grounding** — The narrative explanation of "why this order" ties back to prioritization evidence and dependency reality, not to internal preference.

## Common failure modes to look for

- An item sequenced before the infrastructure it depends on, with a hand-wave about parallel work
- External dependencies cited as scheduled without naming the partner contact or the signoff path
- A milestone whose completion criterion is the same sentence as its name
- Capacity assumptions that ignore on-call rotation, incident load, and ongoing operational work
- A single named individual on three concurrent critical paths
- A strategic narrative that asserts strategic intent without citing the user-research insights or discovery findings that justify it
