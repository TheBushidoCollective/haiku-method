---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the cutover runbook includes a viable rollback (or an explicit forward-fix-only rationale) at every step, that the point of no return is marked exactly once per dependency chain, that the validation stage's rollback rehearsal record is cited, and that post-cutover write handling is addressed. Untested rollback under outage pressure is how migrations turn into incidents.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Rollback entry per reversible step** — every step classified as reversible (fully / with-loss / at-cost) has a matching rollback entry with the same step id, mirrored structure (preconditions, action, post-condition, duration), and a reverse procedure.
- **Forward-fix rationale for irreversible steps** — every step past the point of no return explicitly states "forward-fix only — see forward-fix procedure" and links the procedure. Silent absence of rollback is a hard finding.
- **Point of no return marked exactly once** — the cumulative cutover chain has exactly one step (per dependency path) flagged as crossing the point of no return. Multiple markers or none at all are findings.
- **Validation rehearsal cited** — every rollback procedure cites the validation-stage rollback rehearsal record (procedure, dataset, observed RTO). If no rehearsal record exists, the fix is to run validation, not to rehearse inside cutover — file feedback against validation, not cutover.
- **Reverse-duration fits cumulative RTO** — each rollback step's expected reverse duration sums into the cumulative RTO budget the intent declared. Steps that don't fit are findings.
- **Post-cutover write handling** — every reversible step that crosses any window where the target accepts writes addresses how those writes are handled on rollback (replicate back, drop with impact statement, escalate). Silent loss is a hard finding.
- **Communication plan covers rollback** — the runbook's communication plan names audiences and triggers for rollback initiation, completion, and partial-rollback states, not just success paths.
- **Reversibility classification explicit** — every step carries an explicit class (fully reversible / reversible with loss / reversible at material cost / forward-fix only).

## Common failure modes to look for

- A rollback entry that references state the forward step destroys (no snapshot, no log, no source-as-authoritative remnant)
- Reverse duration much shorter than the forward duration without justification — usually a sign the rollback hasn't been thought through
- Point of no return implicitly assumed but not marked on a specific step
- "Rollback is tested" claim without citing the validation rehearsal record
- Post-cutover writes addressed only for the happy rollback path, not for partial-rollback states
- Communication plan that names audiences for go but not for no-go
- Rollback procedure that depends on the same person being on-call who executed the forward step
- A step classified as "fully reversible" that actually loses data written to the target during its window
