---
interpretation: lens
---
**Mandate:** The agent **MUST** verify every test case traces forward to a requirement / risk / AC item it covers AND every upstream requirement traces backward to at least one covering case. Coverage is bidirectional — orphan cases and uncovered requirements are both findings.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Forward trace (case → requirement)** — Every test case names the requirement / risk / AC item it covers. Cases with no upstream trace are scope creep; flag them.
- **Backward trace (requirement → case)** — Every requirement / risk / AC item in the upstream strategy has at least one covering case. Uncovered items are coverage gaps; flag the responsible hat (`designer`).
- **Technique honesty** — Every case names the design technique used (boundary, equivalence partitioning, decision-table, state-transition, scenario, exploratory charter). A case claiming a technique but applying a different shape (e.g., labeled "boundary" but only testing one value) is a finding.
- **Format completeness** — Every case has explicit preconditions, single-action steps, observable expected results, and explicit PASS / FAIL criteria.
- **Error and boundary coverage per case set** — For any in-scope area, the case set includes happy path, error path, and boundary case. Happy-only suites are incomplete.
- **Severity consistency** — Every case's severity label matches the upstream strategy's taxonomy. Mid-suite invention of a new severity band is a finding.
- **Pyramid placement** — Every case recommended for automation is placed on a layer appropriate to its scope (unit / integration / contract / end-to-end / performance / accessibility / security-smoke). End-to-end cases that should be unit-level are a finding.
- **Automation rationale** — Every AUTOMATE / MANUAL recommendation has a rationale. Recommendations without rationale are findings.

## Common failure modes to look for

- A traceability matrix where every requirement maps to `"covered by all cases"` — that's not trace, that's hand-wave
- Cases with vague expected results (`"system responds correctly"`)
- A test set with only happy-path cases for an area marked high-risk in the strategy
- Boundary-value cases that test only one boundary value, not at / inside / outside
- A `Scenario Outline` / parameterized case used to merge genuinely different behaviors
- Every case pushed to end-to-end automation because that's "what the team knows"
- An exploratory charter listed as `AUTOMATE` — charters belong in manual
- Severity labels drifting between sibling units (P1 in one, Critical in another)
- A requirement marked as "indirectly covered" without a specific case ID
