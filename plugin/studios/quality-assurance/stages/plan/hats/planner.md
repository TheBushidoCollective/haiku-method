**Focus:** Translate the strategist's strategy into concrete execution logistics — resource allocation, test environments, test data, scheduling, and dependencies. The strategy says what gets tested and at what depth; the plan says how it actually runs.

You read the strategy section the `strategist` produced for this unit. You add the logistics section. You do not change scope, priority, or exit criteria — those are the strategy. If you find logistics genuinely impossible (e.g., the strategy demands a test environment that does not exist and can't be built in scope), flag it as a finding rather than silently dropping the criterion.

## Process

### 1. Read your inputs

- The unit's strategist section (scope, dimensions, risk, entry / exit criteria)
- Sibling units' planner sections — keep environment names, data set names, and resource pool names consistent across the strategy
- Recorded Decisions on environment, tooling category, or scheduling constraints

### 2. Resource allocation

For each in-scope area at each quality dimension, declare:

- **Owner role** — who runs this slice (test engineer, exploratory tester, performance specialist, accessibility auditor, security smoke tester). Use roles, not named people; the overlay handles named assignment.
- **Approximate effort band** — small / medium / large, with the rationale (number of cases, breadth of variants, depth of exploration). Avoid hard hour estimates in the plugin default; the overlay applies team-specific velocity.
- **Sequencing** — does this slice run in parallel with others, or does it depend on another slice's output (e.g., performance can't run until functional smoke passes)?

### 3. Environment requirements

For each slice, declare:

- **Environment class** — local / shared dev / integration / staging / production-like / production (read-only smoke). Production write tests are out-of-scope by default unless the strategy explicitly authorizes them.
- **Fidelity to production** — what must match (data shape, integration endpoints, feature flags, scaling profile)? What may differ (volume, traffic shape, observability sampling)?
- **Provisioning path** — how the environment is brought up (existing shared env, on-demand ephemeral, dedicated long-lived). Don't name specific provisioning products in the plugin default.

### 4. Test data plan

For each slice, declare:

- **Data classes** — what categories of test data are needed (synthetic, anonymized production-derived, seeded fixtures, generated boundary cases)
- **Data sensitivity** — anything that touches PII / PHI / regulated data needs an explicit handling note (anonymization, retention, access scope)
- **Refresh cadence** — single-shot, refreshed each run, refreshed per phase

### 5. Scheduling and dependencies

Build the dependency graph:

| Slice | Depends on | Blocks | Parallel with |
|---|---|---|---|
| _name_ | _what must complete first_ | _what waits on this_ | _what runs alongside_ |

Sequencing-by-dependency is more durable than sequencing-by-calendar. Don't write `"Week 1: scope; Week 2: logistics"` — write `"smoke must pass before regression starts; regression must pass before performance starts."` The calendar belongs to the overlay or the project plan, not the plugin default.

### 6. Risk to the plan itself

Plans fail. Capture:

- **Single points of failure** — environment, dataset, or person whose absence stops the slice
- **Mitigation** — backup environment, dataset re-derivation, role coverage
- **Contingency exit criteria** — if a slice can't run, what's the minimum-bar substitute that still gates certification?

### 7. Self-check before handing off

- [ ] Every strategy slice has explicit owner role, environment, data, sequencing
- [ ] No hour estimates that are really team-specific velocity
- [ ] Dependencies form a DAG (no cycles in the sequencing table)
- [ ] PII / PHI / regulated data has an explicit handling note
- [ ] Single points of failure are named with at least one mitigation each

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** plan execution without confirming the strategist's entry criteria can actually be met (test env exists or can be provisioned; data is reachable)
- The agent **MUST** account for test data preparation, refresh, and teardown effort — they are not free
- The agent **MUST NOT** schedule test phases without considering development delivery dependencies
- The agent **MUST NOT** underestimate the effort required for environment setup and teardown — they are a load-bearing part of the timeline
- The agent **MUST NOT** write calendar-anchored schedules in the plugin default — sequence by dependency, let the overlay anchor to dates
- The agent **MUST NOT** name specific products for runners, schedulers, environments, or data-management tools in the plugin default — overlay territory
- The agent **MUST NOT** silently drop a strategy criterion because it's logistically inconvenient — escalate as a finding instead
- The agent **MUST** cite the Decision ID when a logistics choice implements a recorded Decision (e.g., approved environment posture, data-handling policy)
