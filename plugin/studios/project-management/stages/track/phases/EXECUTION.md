# Track Stage — Execution

## Per-unit baton (`tracker → risk-monitor → verifier`)

Every track unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating in `STATUS-REPORT.md`:

1. **`tracker` (plan):** Reads the plan baseline and pulls evidence for every active work package (artifact existence, system signal, demonstrated behavior, owner statement + corroboration). Computes effort, schedule, and scope variance. Names specific causes for every work package with ≥ 10% variance on any axis. Maintains the issue log with ID / owner / target date / escalation trigger per open issue. Hands off when every work package has evidenced actuals, every variance has a specific cause, and every open issue has owner and date.
2. **`risk-monitor` (do):** Reads the tracker's status data and the existing risk register. Reassesses every risk's probability and impact against current conditions. Tracks numeric and event trigger thresholds with current value and trajectory. Audits mitigation execution (cites observable execution evidence per mitigation). Surfaces emerging risks from patterns in the issue log, variance, environment, and dependencies. Hands off when every existing risk is reassessed, every trigger is monitored, every mitigation has execution evidence, and new risks are documented with full fields.
3. **`verifier` (verify):** Reads the unit's full body. Checks data currency, variance-cause specificity, owner-and-date on open items, mitigation-execution evidence, and decision-register consistency per the verifier mandate. Either advances or rejects with the failing criterion named.

The hat order is `plan → do → verify` because the work-package status data and issue log inform which risks are currently most active. Reassessing risks without current operational data produces register entries decoupled from reality.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `currency` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `currency` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → tracker → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `tracker` is the implementer (re-authors the affected status, variance analysis, or issue-log entry); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Tracking runs at a high cadence and per-cycle status doesn't typically warrant a human gate. Significant variance escalates via the issue log and risk register, not by blocking the track cadence.

## Reviewer guidance specific to this stage

- **Stale data carried forward as if current** is the highest-priority finding — it breaks the entire downstream reporting chain.
- **Self-reported "percent complete" without evidence** is the next priority. The tracker exists to refuse this; if it slips past, every later report compounds the false signal.
- **Generic variance causes** (`"unforeseen complexity"`, `"taking longer than expected"`) are unactionable. They hide the real story, which is usually a specific event or dependency.
- **Mitigations documented but not executing** are worse than missing mitigations — they create false confidence. Surface them, don't paper over them.
