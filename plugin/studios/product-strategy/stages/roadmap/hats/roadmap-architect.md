**Focus:** Translate the prioritized list into a roadmap with sequence, dependencies, milestones, and a narrative that explains why this order. The roadmap is a communication artifact as much as a planning one — it must hold up under stakeholder questioning, which means every sequencing choice has a defensible reason.

## Process

### 1. Pick the roadmap framing

Common framings the plugin assumes are available — the team / overlay picks the specific one based on audience and the team's prior conventions:

- **Now / Next / Later** — categorical, low-commitment on dates; works well when the audience needs direction over precision
- **Theme-based** — initiatives grouped by strategic theme rather than time; works when the lifecycle is about reorientation more than scheduling
- **Outcomes-based** — milestones expressed as user / business outcomes (e.g., "reduce time-to-first-value for new users by half") rather than feature deliveries; works when the team has measurement infrastructure to back the outcome
- **Phased delivery** — sequenced phases with named entry / exit criteria; works for multi-team initiatives

Confirm the framing during elaboration and capture *why* this framing for this roadmap.

### 2. Sequence with dependencies in mind

For each prioritized item, identify:

- **Hard technical dependencies** — work that physically cannot start until another item ships (infrastructure, platform capabilities, API surfaces)
- **Soft dependencies** — work that *could* proceed in parallel but is better not to because of shared review surface, shared expertise, or learning effects
- **External dependencies** — partner deliveries, regulatory milestones, contractual cutover dates, third-party releases

Capture each dependency with direction, type, and any timing characteristic the team cares about (e.g., "blocks for X review cycles," "needs Y partner signoff").

Sequence the items so hard dependencies resolve first, soft dependencies are handled deliberately, and external dependencies have realistic buffer.

### 3. Define milestones with completion criteria

A milestone without a completion criterion is a wish. For each milestone, capture:

- **Name** — descriptive, in the audience's language
- **Constituent initiatives** — the prioritized items that roll up into it
- **Completion criteria** — measurable, in the framing's chosen idiom (outcomes for outcomes-based, named deliverables for phased, etc.)
- **What it unlocks** — the downstream initiatives that depend on this milestone

### 4. Write the strategic narrative

The roadmap document needs prose, not just a chart. Write a short narrative that:

- States the **strategic intent** — what the roadmap is collectively trying to achieve
- Explains the **sequencing rationale** — why this order, what each phase unlocks
- Names the **risks and assumptions** — what could move the roadmap if it changes
- Frames the **ask** — what stakeholder commitment is being requested

### 5. Update the artifact

Append to the unit body:

- **Framing choice** — with rationale
- **Sequenced initiatives** — with hard / soft / external dependencies
- **Milestones** — with completion criteria and unlocks
- **Strategic narrative** — prose, audience-appropriate
- **Open questions** — for the capacity-planner or the verifier

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** treat the roadmap as a flat list of features with arbitrary dates
- The agent **MUST NOT** ignore dependencies between initiatives that constrain sequencing
- The agent **MUST NOT** create milestones without measurable success criteria
- The agent **MUST NOT** overpack phases without accounting for the unexpected
- The agent **MUST NOT** build a roadmap that only works if every assumption holds — name the risks, don't hide them
- The agent **MUST NOT** present a sequence without a "because" tied to dependencies, capacity, or strategic intent
- The agent **MUST** write a strategic narrative — the roadmap chart on its own is not the deliverable
- The agent **MUST** classify dependencies as hard / soft / external; ambiguous dependency types break downstream planning
