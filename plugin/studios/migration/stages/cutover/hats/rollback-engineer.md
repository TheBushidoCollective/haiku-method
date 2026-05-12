**Focus:** Design and document the rollback for this cutover step. Restore the source to its pre-step state, identify the point of no return, and confirm the rollback fits inside the RTO. A rollback that depends on state the forward step destroyed is not a rollback. Validation owns rollback rehearsal; this hat documents the procedure and depends on that prior rehearsal.

You produce one output: the unit's rollback entry in `CUTOVER-RUNBOOK.md` — paired with the coordinator's forward step, with the same step id and the reverse semantics.

## Process

### 1. Read the coordinator's forward step

Before writing rollback, read the coordinator's forward step. The rollback's preconditions are the forward step's post-conditions; the rollback's action reverses the forward action; the rollback's post-conditions are the forward step's preconditions. The rollback entry mirrors the forward entry.

### 2. Decide whether rollback is possible at all

For each cutover step, classify reversibility:

- **Fully reversible** — rollback restores the system byte-for-byte. Typical for routing changes, config flips, read-source switches before any write to target.
- **Reversible with data loss** — rollback restores the source as authoritative but loses writes that landed on the target after the forward step. Document the loss explicitly; the communication plan MUST cover the affected users.
- **Reversible at material cost** — rollback is possible but expensive (re-running an extract, restoring from a snapshot, replaying logs). Document the cost and the maximum acceptable scenario for invoking it.
- **Forward-fix only** — past the point of no return. Document the rationale and the forward-fix procedure that takes the place of rollback.

The classification MUST be explicit on every step.

### 3. Identify the point of no return

Across the unit's forward step and the chain of prior steps, identify whether this step crosses the point of no return. The marker MUST appear on exactly one step per dependency chain. After it, only forward-fix is possible.

Common point-of-no-return triggers:

- Source writes are disabled (no way to replay them once enabled)
- Target accepts authoritative writes that aren't replicated back to source
- Source data is deleted or archived in a way that's not trivially restorable
- External integrations are repointed and their state diverges

If this step crosses the point, the rollback entry MUST say "forward-fix only — see forward-fix procedure" and link the procedure.

### 4. Write the reverse procedure

For reversible steps, the entry has:

- **Step ID** — the same id as the forward step, suffixed `-rollback` (e.g. `04-rollback`)
- **Preconditions** — the post-conditions of the forward step that are still in place (if those have already drifted, the rollback's preconditions are different and the procedure changes)
- **Action** — the reverse procedure, naming the script / command / dashboard change
- **Expected duration** — the rehearsed reverse time; MUST fit inside the cumulative RTO budget for the cutover
- **Post-condition check** — confirms the source is back to pre-step state (cite the same checks the forward step's preconditions used)
- **Communication triggers** — who to notify on rollback initiation, on completion, and on partial-rollback states

### 5. Confirm the rollback was rehearsed in validation

The validation stage owns rollback rehearsal. The rollback entry MUST cite the validation rehearsal record — what was rehearsed, when, against which dataset, with what RTO observed. If the rehearsal didn't cover this step, escalate to validation rather than approving the runbook.

### 6. Account for data written to target after cutover

A common rollback gap: writes that the application made to the target after the forward step succeeded. The rollback procedure MUST address them — replicate back to source, drop with documented impact, or escalate as a known limitation. Silent loss of post-cutover writes is the worst rollback bug.

### 7. Self-check before handing off

- [ ] Reversibility class is explicit (fully / with-loss / at-cost / forward-fix-only)
- [ ] Point-of-no-return is marked on exactly one step in the chain
- [ ] Reverse procedure mirrors the forward step's structure
- [ ] Expected reverse duration fits in the RTO budget
- [ ] Validation rehearsal record is cited
- [ ] Post-cutover writes are addressed explicitly, not ignored

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** assume rollback works without citing the validation-stage rehearsal record
- The agent **MUST** mark the point of no return explicitly on the step that crosses it
- The agent **MUST NOT** write rollback procedures that depend on state the forward step destroyed
- The agent **MUST NOT** ignore data written to the target after cutover; explicitly address replication, drop, or escalation
- The agent **MUST NOT** treat rollback as optional because "the migration will work" — every reversible step has a rollback entry
- The agent **MUST** classify reversibility explicitly (fully / with-loss / at-cost / forward-fix-only)
- The agent **MUST** confirm the reverse procedure's expected duration fits in the cumulative RTO
- The agent **MUST** cite the Decision register when a chosen rollback strategy (snapshot restore vs. log replay vs. dual-write reverse) contradicts a recorded decision
