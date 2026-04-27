---
skip: [design-direction, wireframes]
add: []
wireframe_fidelity: skip
criteria_focus: product
---

# Product Stage — Elaboration

## Criteria Guidance

Product criteria are verified by **behavioral testing** — automated tests (e.g. Cucumber `.feature` scenarios, integration tests, contract tests) that assert the system behaves as specified.

### Good criteria — concrete and verifiable

When generating criteria for this stage, focus on behavioral verification:

- Detailed behavioral specs that describe what the system does, not how it is built
- Acceptance criteria for every user-facing scenario, each expressible as a Given/When/Then test
- Edge cases, error paths, and boundary conditions explicitly covered
- Data contracts, validation rules, and state transitions specified with concrete examples
- Integration points and external dependency behavior documented (with mock or contract-test specifications)
- Behavioral specs precise enough for a developer to implement without follow-up questions

### Bad criteria — vague (no clear check)

- "Works correctly" — under what conditions? With what input?
- "Handles errors" — which errors? What's the expected response?
- "Data is validated" — against which schema? What error format?

### Bad criteria — product-specific unverifiable

(In addition to the universal unverifiable shapes called out in the FSM contracts.)

- "Behavior is intuitive" — needs a usability-test pass with a stated success-rate threshold
- "Coverage is comprehensive across the user-facing capability list" — needs a structural check counting scenarios against the capability list, not a subjective judgment

## Unit `outputs:` — required artifact shape

Every unit MUST declare its produced artifacts as **real file paths** in the `outputs:` frontmatter. The advance-hat gate verifies each path exists on disk; freeform descriptions get rejected at write time and at advance time.

For product-stage units, the typical artifact set is:

```yaml
outputs:
  # Behavioral spec — Gherkin .feature file the specification hat
  # writes to features/. Per the behavioral-spec template, units MUST
  # produce at least one .feature file when they cover user-observable
  # behavior. Reference the file by its actual path, not by name.
  - .haiku/intents/{intent-slug}/features/my_week.feature

  # Acceptance criteria — markdown produced by the product hat for
  # this slice of behavior. Lives at .haiku/intents/{intent-slug}/product/
  # (NOT knowledge/ — that's discovery-stage territory).
  - .haiku/intents/{intent-slug}/product/ACCEPTANCE-CRITERIA.md

  # Data contract — schema/API/DB shape touched by this unit.
  - .haiku/intents/{intent-slug}/product/DATA-CONTRACTS.md
```

Substitute the bracketed paths with the unit's real intent slug and feature filename. The validator hat's `COVERAGE-MAPPING.md` is one shared file across the stage — typically only the validator hat's terminal unit lists it as an output.

**MUST NOT**: write prose like `outputs: ["Weekly carryover roll: scheduler trigger, idempotent roll logic"]`. That's a completion-criteria description, belongs in the body's `## Completion Criteria` section, and the gate now rejects it as `unit_outputs_missing` (no real path matches).
