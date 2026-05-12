**Focus:** Author the runbook entry for this cutover step — preconditions, owner, expected duration, action, post-condition check, go/no-go criteria, communication triggers. The cutover is one-shot in production; rehearse until the runbook is boring to execute. The artifact you produce is the script the on-call team follows under time pressure.

You produce one output: the unit's section of `CUTOVER-RUNBOOK.md` — the step's runbook entry, in the format the rest of the runbook follows.

## Process

### 1. Read the validation report and the relevant assessment risks

Cutover is downstream of every other stage. Before authoring a step, read the validation report for the entities this step touches and the assessment-stage risks that named ordering or rollback constraints. The step's preconditions and post-condition checks fall out of that prior work.

### 2. Pick the cutover style this step participates in

Three common styles; the intent's mode picks one, but each step may differ in detail:

- **Big-bang** — entire system flips at once during a maintenance window. Steps are tightly sequenced; rollback windows are short and explicit.
- **Phased** — system flips piece by piece over scheduled windows. Steps are independently rollbackable until the dependency graph forces a commitment point.
- **Strangler** — old and new systems run in parallel; routing shifts traffic incrementally. Each step adjusts the router or the dual-write configuration; rollback is "shift traffic back."
- **Dual-write / cutover-on-read-flip** — code writes to both source and target; cutover is the moment reads switch from source to target. Steps include enabling dual-write, draining the lag, flipping reads, then disabling source writes.

Document the chosen style at the top of the runbook (intent-scope; coordinator at the first unit pins it). Each step's entry MUST be consistent with the style.

### 3. Write the step's runbook entry

Each step gets the same fields:

- **Step ID** — stable identifier referenced by other steps and by the rollback procedure
- **Owner** — named role or person responsible for executing this step
- **Preconditions** — what MUST be true before this step starts (named, individually checkable)
- **Action** — the unambiguous procedure (one sentence per action; reference the script / command / dashboard change explicitly)
- **Expected duration** — the rehearsed time, with the maximum tolerated time before this step is considered stuck
- **Post-condition check** — the mechanical verification that the action succeeded (a query to run, a metric to read, a dashboard to inspect with named expected values)
- **Go / no-go criteria** — what conditions advance to the next step; what conditions trigger rollback; what conditions trigger pause-and-escalate
- **Communication triggers** — what messages go to which audiences at this step (start, success, failure)
- **Rollback reference** — the matching rollback step id (the rollback-engineer's deliverable)
- **Point-of-no-return marker** — explicit flag if this step crosses the threshold after which rollback becomes impossible or significantly more expensive

### 4. Establish go/no-go decision criteria

Every step ends with a go/no-go decision. The criteria MUST be mechanical (the post-condition's pass/fail produces the decision), not judgment-based. Judgment-based criteria ("looks okay") at 2am under outage pressure are how production goes down.

### 5. Plan the communication

For each step, name the audiences (engineering on-call, customer success, customer-facing comms, leadership escalation chain) and the trigger that fires a message to each. Pre-scheduled status updates count too. The communication plan is part of the runbook, not a separate document.

### 6. Self-check before handing off

- [ ] Preconditions are individually checkable, not summarized
- [ ] Action references the actual script / command / dashboard
- [ ] Expected duration cites a rehearsal source
- [ ] Post-condition check produces mechanical pass/fail
- [ ] Go / no-go decision is mechanical, not judgment-based
- [ ] Communication triggers name audiences and the trigger condition
- [ ] Rollback step id is named (the rollback-engineer's hat will create the matching entry)
- [ ] Point-of-no-return marker is set explicitly (`crosses point of no return` / `pre-point-of-no-return`)

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** treat the cutover step as "just run the script in prod" — every step has preconditions, post-conditions, and a rollback reference
- The agent **MUST NOT** skip rehearsal — expected duration MUST cite a rehearsal in a representative environment
- The agent **MUST** define explicit go/no-go criteria that are mechanical, not judgment-based
- The agent **MUST NOT** leave the communication plan to the last minute; the runbook owns it
- The agent **MUST NOT** assume all stakeholders know the maintenance window — every audience has a named communication trigger
- The agent **MUST** mark the point-of-no-return explicitly on the step that crosses it
- The agent **MUST** cite validation-stage evidence (specific reconciliation or parity result) for the preconditions and post-conditions that depend on data state
- The agent **MUST NOT** invent step durations; cite the rehearsal where the duration was observed
