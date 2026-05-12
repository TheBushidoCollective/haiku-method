# Communicate Stage — Execution

## Per-unit baton (`communicator → planner → verifier`)

Every communicate unit walks the three hats in order:

1. **`communicator` (plan):** Reads the decision brief. Maps the audiences with role, primary concern, likely first reaction, channel, and timing. Builds the messaging framework — core decision statement (identical across audiences), rationale tier per audience, "what this means for you" per audience, the rejected option named explicitly, and risks proportional to each audience's role. Writes the FAQ covering the hardest predictable question per audience. Hands off when the messaging framework is consistent across audiences and every audience has its per-channel materials.
2. **`planner` (do):** Reads the communicator's framework. Decomposes the rollout into workstreams (communication cascade, operational change, resource shift, external engagement, measurement). Sequences actions within and across workstreams with named owners, dependencies, measurable milestones, and resource requirements. Builds contingencies on high-risk steps. Validates capacity and authority of named owners. Names the first review point and the on-track / off-track signals. Hands off when the plan is actionable end-to-end.
3. **`verifier` (verify):** Reads the unit body. Checks substance, traceability to the decision brief, internal coherence, and decision-register consistency per the body-only mandate.

The hat order is `plan → do → verify` because the messaging defines the audiences and timing; the rollout plan operationalizes them. Reversing makes the plan generic.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `consistency` review agent fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, communicator, feedback-assessor]` dispatches per finding. The classifier routes the FB. `communicator` is the implementer (re-aligning messaging across audiences, strengthening a FAQ entry, or fixing a numerical inconsistency between materials). The assessor independently decides closure.
4. **Gate** — The stage's gate is `ask` — local human approval. The communicator's words become the organization's words; the user reads what's about to go out.

## Reviewer guidance specific to this stage

- **Numerical or factual drift across materials** is the single highest-priority finding — different numbers in the investor letter vs. the all-hands deck destroys credibility instantly.
- **Substantive omission per audience** — softening a risk for one audience that other audiences see is a finding; tailoring is emphasis, not substance.
- **Vague rollout actions** ("communicate to stakeholders") without owners or measurable end states will not execute; flag them.
- **Capacity collisions** — a named owner with multiple critical-path actions in the same window is a failure mode the planner needs to address.
- **Missing reversal / off-track signals** — a rollout plan that ends at launch with no review point quietly dies; flag as a finding.
- **FAQ that ducks the hard question** — entries that say "we expect this to go smoothly" instead of answering directly are setting the organization up to be caught flat-footed.
