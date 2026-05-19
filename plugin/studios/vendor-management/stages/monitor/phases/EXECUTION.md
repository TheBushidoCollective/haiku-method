# Monitor Stage — Execution

## Per-unit baton (`monitor → relationship-manager → verifier`)

Every monitor unit walks the three hats in order. The baton across the rally race is the performance report plus the relationship assessment accumulating on disk:

1. **`monitor` (plan / do for performance):** Re-reads the contract every cycle (not recalled from memory). Collects both vendor-reported data and independent verification from the organization's side, reconciles them. Calculates against the contract's named measurement method, window, and exclusions. Reports current period plus trend across at least three prior periods. Tracks operational quality beyond the contracted metrics (incidents, support responsiveness, change-management quality, roadmap delivery). Invokes contractual remedies on breach. Hands off the performance report.
2. **`relationship-manager` (do for relationship health):** Reads the performance report and adds the relational view — strategic alignment, operational health beyond SLA, value beyond the contract, third-party-risk evolution, mutual feedback. Identifies expansion and optimization opportunities. Surfaces third-party-risk signals (financial, security, ownership, concentration) with sources and routes them to the negotiation stage via feedback when terms are affected. Produces the relationship health assessment as a section of the performance report.
3. **`verifier` (verify):** Reads each unit's body and validates that preconditions, action, post-condition, and rollback / recovery are stated and substantive. Advances when the bar is met; rejects naming the failed criterion when it isn't.

The hat order produces a complete picture — performance numbers, relationship signal, verified observation. Each cycle yields a fresh performance report.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `accountability` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `accountability` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → monitor → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `monitor` is the implementer (re-runs the affected data collection or trend calculation); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. The engine advances on its own once every observation unit has passed its post-condition check.

The monitor stage is recurring. Each iteration produces a new performance report against the same contract; corrective findings against negotiation terms flow upstream via feedback to the negotiate stage.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Vendor-data-only reporting** is the highest-priority finding — without independent verification, the report mirrors the vendor's narrative.
- **Generic uptime formulas** that ignore the contract's named exclusions or measurement window produce calculations that don't survive an SLA dispute.
- **Tolerated breaches** (noted without remedy invocation) retrain the threshold and erode the contract.
- **Relationship signals as adjectives** ("responsive", "healthy") instead of specific data (response times, issue counts, named events) are unverifiable.
- **Third-party-risk signals noted but not routed back to negotiate** become surprise findings at renewal.
