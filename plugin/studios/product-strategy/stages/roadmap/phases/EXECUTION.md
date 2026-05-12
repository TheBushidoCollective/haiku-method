# Roadmap Stage — Execution

## Per-unit baton (`roadmap-architect → capacity-planner → verifier`)

Every roadmap unit walks the three hats in order. The baton across the rally race is the unit body accumulating sequence, then capacity reality:

1. **`roadmap-architect` (plan / sequence):** Picks the framing (now/next/later, theme-based, outcomes-based, or phased delivery) during elaboration. Sequences the prioritized items with hard / soft / external dependencies named, defines milestones with measurable completion criteria, and writes a strategic narrative explaining "why this order."
2. **`capacity-planner` (do / reality-check):** Establishes the capacity baseline (team composition, committed external work, skill availability, infrastructure, budget — each cited). Maps roadmap demand to capacity, flags gaps with severity, proposes at least one mitigation per gap, and recommends revisions if any blocker surfaced.
3. **`verifier` (verify):** Validates the artifact body-only — dependency chains resolve, capacity assumptions are realistic and cited, milestones have measurable completion criteria, risks and assumptions are named. Advances or rejects with a named criterion.

The hat order is `plan → do → verify` because capacity is reality-checked against a complete sequence, not a partial one, and the verifier checks the combined artifact.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `feasibility` review agent fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, roadmap-architect, feedback-assessor]` dispatches per finding. The classifier routes the FB; the roadmap-architect re-sequences against the gap; the assessor independently decides closure.
4. **Gate** — `ask`. Roadmap commitments are visible to the rest of the org and the user owns the final shape before stakeholder-review presents it externally.

## Reviewer guidance specific to this stage

- **A milestone whose completion criterion is the same sentence as its name** is the highest-priority finding — milestones without measurable criteria can't be verified or signaled to stakeholders.
- **Dependency-direction errors** (an item sequenced before the infrastructure it requires) ship plans that break on first execution.
- **100%-utilization capacity plans** are findings to file; the 80% ceiling accounts for incidents, on-call, unplanned work, and learning curves.
- **External dependencies cited as scheduled without a named partner contact or signoff path** are roadmap items waiting to slip.
