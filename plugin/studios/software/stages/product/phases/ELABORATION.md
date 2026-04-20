---
skip: [design-direction, wireframes]
add: []
wireframe_fidelity: skip
criteria_focus: product
---

# Product Stage — Elaboration

## Criteria Guidance

When generating criteria for this stage, focus on behavioral verification:

- Detailed behavioral specs that describe what the system does, not how it is built
- Acceptance criteria for every user-facing scenario
- Edge cases, error paths, and boundary conditions explicitly covered
- Data contracts, validation rules, and state transitions specified
- Integration points and external dependency behavior documented
- Behavioral specs precise enough for a developer to implement without follow-up questions

Product criteria are verified by **behavioral testing** — automated tests that verify the system behaves as specified.

Bad criteria: "Works correctly", "Handles errors", "Data is validated"


## Quality Gate Format

Unit `quality_gates:` frontmatter MUST use executable gate objects, not prose strings. Each entry is `{ name, command, dir? }` — the FSM runs the command at advance_hat time; non-zero exit blocks the advance. Commands MUST scope to the full stage artifact directory (e.g. `stages/{stage}/artifacts/`), not only the unit's declared `inputs:` list — enforcement scope must match rule scope, or regressions creep back onto files no unit audited. Prose descriptions of intent belong in the unit body under `## Completion criteria`, not in the frontmatter. The universal gate guidance injected into every `elaborate` action's output carries the worked canonical example.
