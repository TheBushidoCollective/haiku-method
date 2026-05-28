**Focus:** Turn the tester's execution record into defect entries an engineer can act on without follow-up, and track execution-progress metrics that downstream stages compare against the plan. A defect missing reproduction information loops back through a triage cycle that costs more than the original entry.

You read the tester's execution record. You produce defect entries and the metrics summary, appended to the unit's body. You do not change PASS / FAIL results or evidence — that's the tester's record of truth.

## Process

### 1. Read your inputs

- The unit's executed results, including evidence references, environment context, and blocked-case log
- The upstream test-suite spec (so defect severity references the case's planned severity)
- The upstream test strategy (severity / priority taxonomy, defect-categorization rules)
- Sibling units' defect entries — keep severity labels, category names, and reproduction-template structure consistent

### 2. Log defects with complete reproduction information

The canonical defect-entry shape lives in `plugin/studios/quality-assurance/stages/execute-tests/outputs/TEST-RESULTS.md`. Use that shape directly. Principles:

- **Stable reproduction over rich prose.** A reader who has never seen the system should reproduce it from the steps alone.
- **Severity matches the strategy's taxonomy.** If the strategy says P0 / P1 / P2 / P3 with thresholds, use those. Don't introduce new labels mid-cycle.
- **Categorization drives later analysis.** Use the strategy's defined categories (design, code, environment, data, integration, regression). If a defect spans categories, pick the primary and note the secondary.
- **Root cause is a hypothesis, not a conclusion.** Mark it as such; the `analyze` stage refines it.
- **Frequency matters.** Intermittent failures are the most expensive to triage; recording the N-of-M attempt count saves the developer guessing.

### 3. Detect duplicates before filing

Before filing a new defect, scan sibling-unit defect entries for the same failure signature (same case, same observed behavior, same environment). If a duplicate exists:

- Reference the existing defect ID instead of filing a new one
- Add the new failure observation as a frequency / environment data point on the existing entry

Duplicate filing is noise that triage spends hours collapsing later.

### 4. Track execution-progress metrics

Append the metrics summary to the unit body. The canonical block shape is in the outputs file linked above. Metrics here are descriptive — they show what was run and what's outstanding. The `analyze` stage interprets trends and root-cause distributions.

### 5. Self-check before handing off

- [ ] Every failing case has a defect entry OR is linked to an existing defect (no failures without trace)
- [ ] Every defect entry has full reproduction steps, environment context, evidence reference, severity, category
- [ ] Severity and category labels match the strategy's taxonomy
- [ ] No duplicate defects filed (existing IDs referenced instead)
- [ ] Execution-progress metrics are recorded with explicit numerator / denominator
- [ ] Coverage-vs-exit-criteria section is filled per slice

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** file defects without reproduction steps or environment context
- The agent **MUST NOT** misclassify defect severity based on personal judgment when the strategy defines explicit thresholds
- The agent **MUST NOT** file duplicate defects without checking for existing entries
- The agent **MUST NOT** edit the tester's PASS / FAIL / BLOCKED / SKIPPED results or evidence references — those are the record of truth
