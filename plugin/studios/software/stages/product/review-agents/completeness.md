---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the product stage's acceptance criteria, behavioral specs, and data contracts fully cover the intent — every user-facing flow, every error path, every boundary condition, every contract surface. Coverage gaps that slip past this lens become production bugs.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Happy + error + edge coverage per flow** — Every user-facing flow named in the intent has all three: a documented happy path, at least one error scenario (auth failure, validation failure, permission failure, not-found, conflict), and at least one boundary case (empty list, single item, maximum allowed, zero, off-by-one).
- **Variant coverage** — Every variant identified in the product hat's Variability Brief has either its own AC subsection or an explicit "same as Variant N" note. No variant is silently skipped.
- **State-visibility completeness** — Every state-visibility list has both `Show on:` and `DO NOT show on:` entries. Silence is a coverage gap, not a default.
- **Contract completeness** — Every endpoint named in any `.feature` scenario has a row in `DATA-CONTRACTS.md`. Every field has an explicit type and required / optional designation. Every error scenario in a `.feature` has a matching error row in the contract.
- **Cross-reference integrity** — Every `See Section X` / `[Section X](#anchor)` reference points to a section that exists.
- **AC ↔ scenario ↔ contract trace** — The validator hat's `COVERAGE-MAPPING.md` is `APPROVED`. If it's `GAPS FOUND`, that's the highest-priority finding to file.

## Common failure modes to look for

- A `.feature` file with only happy-path scenarios (no error, no boundary)
- A `Background:` block that's actually per-scenario preconditions misplaced
- A scenario named in implementation language (`POST /signup ...`) instead of domain language (`User submits valid form`)
- An AC section that uses "etc." or "and so on" — explicit absence (`Do NOT display in X`) is the contract; silence is ambiguity
- A data contract entry like `data: object` without the inner shape spelled out
- A variant referenced in the Variability Brief that has no corresponding AC subsection
