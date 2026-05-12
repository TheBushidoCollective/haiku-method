# Deliver Stage — Execution

## Per-unit baton (`facilitator → coordinator → verifier`)

Every deliver unit walks the three hats in order. The baton is `DELIVERY-LOG.md` accumulating session-by-session evidence of what happened operationally and pedagogically:

1. **`facilitator` (plan):** Reads the curriculum plan, the facilitator guide, and the audience profile for THIS cohort. Builds the run-of-show by adapting (not replacing) the facilitator guide. Anticipates engagement and comprehension wobbles — high-risk content, likely questions, energy management points, engagement floors. Runs the session, adapting in real time, reaching silent learners, honoring the practice plan, managing time visibly. Captures questions, confusion points, engagement signals, logistics observations, and improvement candidates as they happen. Hands off when the session is complete and observations are logged.

2. **`coordinator` (do):** Runs the pre-session setup check (scheduling, venue / platform, materials, access, facilitator readiness, accessibility accommodations) with timestamps and confirmation evidence. Runs the technical check 30+ minutes before start. Provides in-session operational support so the facilitator can stay on the learning conversation. Invokes contingency plans when needed and records what happened. Closes out post-session (attendance and completion records to the system of record, recording / transcript distribution, follow-up materials, logistics debrief, issue triage with named owners). Hands off when the operational record is complete.

3. **`verifier` (verify):** Reads the unit body. Validates that preconditions, action, and post-condition checks are all stated, that the post-condition has a verifiable check, that rollback or forward-fix rationale is named where applicable, and that decision-register consistency holds. Either advances or rejects to the responsible hat.

The hat order is `plan → do → verify` because the facilitator's run-of-show is the operational spec the coordinator executes, and the executed session is what the verifier validates.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The `execution` review agent fires alongside any studio-level review agents.
3. **Fix loop (if any feedback opens)** — The `fix_hats: [classifier, facilitator, feedback-assessor]` chain dispatches per finding.
4. **Gate** — Gate is `auto`. Once delivery sessions are complete and the log is sealed, the workflow engine advances to the evaluate stage; systemic delivery issues land as feedback against the next program iteration.

## Reviewer guidance specific to this stage

- **An attendance record without facilitator observations** is the highest-priority finding. Operational completion isn't learning completion; without observations, the evaluate stage is partly blind.
- **A deviation from the facilitator guide without rationale** is a recoverability finding — the gap between intended and delivered program is unrecoverable without the rationale.
- **A logistics issue resolved in the moment but not documented** is a repeat-failure finding — the next session will hit the same issue with the same surprise.
- **A pre-session setup check skipped because "the room is always set up the same way"** is the assumption that creates the next outage; flag it.
- **A recording shared without captions when captioning was a required accommodation** is an accessibility finding that affects every learner who depended on the accommodation.
