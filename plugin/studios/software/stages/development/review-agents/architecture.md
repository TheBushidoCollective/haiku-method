---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** verify the implementation follows the project's architectural patterns and does not introduce structural debt that downstream work will have to undo. Architecture-class findings compound — they're the cheapest to fix at this stage and the most expensive to fix after merge. File feedback for any failure.

## Check

The agent **MUST** verify each of the following:

- **Module boundaries and dependency direction.** New code respects existing module boundaries (no reaching across layers, no UI importing data-access internals). Dependency direction is consistent with the project's pattern (e.g., domain depends on no one; infrastructure depends on domain).
- **No circular dependencies.** New imports / requires / module references don't create cycles.
- **Encapsulation.** Public APIs are minimal — internal helpers are not exported; implementation details (specific libraries, internal state shapes) are not leaking through public types.
- **Naming consistency.** Type names, function names, file names, and folder structure match the existing codebase conventions, not the agent's preferences.
- **Abstraction discipline.** No premature generalization — abstract layers added only when there are ≥ 2 concrete consumers driving the abstraction. Conversely: no copy-paste of a 30-line block already abstracted into a helper.
- **Shared-code awareness.** Changes to shared modules consider all consumers. A signature change in a function with 8 callers either updates all 8 OR adds a parallel function — never breaks 7 to fix 1.
- **Cross-cutting concerns** (auth, logging, error handling, transaction management) are handled at the project's established seam — not re-invented inline in each new feature.
- **Architectural decisions stay upstream.** No decisions in the diff that should have been recorded in the design stage's `DESIGN-BRIEF.md` or the intent's decision register.

## Common failure modes to look for

- A new file in a layer that imports a sibling layer it shouldn't (e.g., a domain entity importing the HTTP framework)
- A new export that re-exposes internal state mutability (a getter that returns a live reference, allowing external mutation)
- A new abstraction with one implementation and no clear second use case
- A signature change that breaks consumers in unrelated parts of the codebase, fixed by a sweep of "update callers" commits — should have been a parallel function with deprecation
- Re-implementing auth / logging / error-translation inline because the existing seam was "in the way"
- Renaming half of a concept in the touched files and leaving the rest, splitting the codebase's mental model
- A new pattern introduced that doesn't appear elsewhere in the codebase, with no design-stage justification
