---
title: Behavioral specifications (Gherkin features)
model: sonnet
depends_on:
  - unit-01-acceptance-criteria
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - stages/design/artifacts/ARCHITECTURE.md
  - stages/design/artifacts/SPA-UI-SPECS.md
  - stages/design/artifacts/MCP-TOOL-CONTRACT.md
  - stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
outputs:
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/silent-filesystem-drop-detection.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/explicit-spa-upload.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/agent-writes-on-behalf-of-human.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/manual-change-assessment.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/drift-assessment-visibility.feature
status: completed
bolt: 1
hat: validator
started_at: '2026-04-29T03:12:15Z'
hat_started_at: '2026-04-29T03:18:11Z'
iterations:
  - hat: product
    started_at: '2026-04-29T03:12:15Z'
    completed_at: '2026-04-29T03:17:13Z'
    result: advance
  - hat: specification
    started_at: '2026-04-29T03:17:13Z'
    completed_at: '2026-04-29T03:18:11Z'
    result: advance
  - hat: validator
    started_at: '2026-04-29T03:18:11Z'
    completed_at: '2026-04-29T03:19:18Z'
    result: advance
completed_at: '2026-04-29T03:19:18Z'
---
# Behavioral specifications (Gherkin features)

Ratify the 5 Gherkin `.feature` files (already drafted at `.haiku/intents/out-of-band-human-file-modifications/features/`) and reconcile their terminology against the unit-01 acceptance criteria, the unit-03 data contracts, and the design-stage architecture spec. Each file must be implementation-ready: scenarios use canonical domain terms verbatim, every AC-G* general rule and AC-EE* edge case from `product/ACCEPTANCE-CRITERIA.md` has at least one matching scenario, edge cases and error paths are covered, and step phrasing is consistent across files so the development stage's step-definition layer can be uniform.

## Scope

The 5 feature files cover the full behavioral surface of this intent. Each must be:

- **silent-filesystem-drop-detection.feature** — implicit pre-tick SHA-baseline drift detection. Covers the 3 motivating scenarios (designer replaces layout, PO edits and asks AI to extend, user uploads knowledge), edge cases (editor temp files, baseline-establishment first-tick, multi-file ticks, mid-bolt timing, deletions, mime-only changes for binaries, addressed vs closed marker clearing).
- **explicit-spa-upload.feature** — SPA upload affordance with per-stage availability scenario outline, replace-vs-upload semantics, hook-bypass invariant, size limit, locked worktree, archived intent.
- **agent-writes-on-behalf-of-human.feature** — sanctioned `haiku_human_write_file`-style MCP tool semantics, authorship integrity, audit log, refusals (workflow-managed paths, escape paths, empty content), interactive vs autopilot mode integrity stances.
- **manual-change-assessment.feature** — agent classification into the four canonical outcomes (`ignore` / `inline-fix` / `surface-as-feedback` / `trigger-revisit`), cross-stage cascade decision, idempotency loop avoidance, binary diff degraded mode, pagination cap, the surface-as-feedback baseline-update contract.
- **drift-assessment-visibility.feature** — SPA drift assessment view, pending/outcome badges, chat-surface notifications in autopilot, noise control for many-ignore runs, pending-revisit transition state.

## Reconciliation requirements (must be enforced before this unit can complete)

This is the gating substance the pre-execute review found missing. None of these are optional.

1. **Canonical change_kind enum** — every step that references a change kind MUST use exactly `added`, `modified`, or `deleted` (verbatim, lowercase, no aliases). If a draft scenario uses `created` / `updated` / `removed` / `replace` etc., rewrite it. This must match `DATA-CONTRACTS.md` and `ARCHITECTURE.md` exactly.
2. **Canonical author_class enum** — every step that references who authored a change MUST use exactly `agent`, `human-via-mcp`, or `human-implicit` (verbatim, lowercase, hyphenated). No `user`, `external`, `manual` aliases.
3. **Canonical outcome enum** — every classification scenario MUST use exactly `ignore`, `inline-fix`, `surface-as-feedback`, or `trigger-revisit` (verbatim, lowercase, hyphenated). The `manual-change-assessment.feature` file must reject any draft language like `auto-fix` or `escalate`.
4. **Outputs vs artifacts alias** — at least one scenario in `silent-filesystem-drop-detection.feature` must explicitly cover stage `outputs/` directories AND stage `artifacts/` directories under the same baseline (per the design-decision that they are aliases for the tracked surface). If only one of the two terms appears across the 5 files, that's a reconciliation failure.
5. **Surface-as-feedback baseline contract** — `manual-change-assessment.feature` must include a scenario for: when the assessor classifies a change as `surface-as-feedback`, the baseline is updated to the new SHA (so the next tick doesn't re-detect the same drift). This is the contract the design called out and unit-01 codified as AC-G7.
6. **Pending-revisit transition** — `drift-assessment-visibility.feature` must include a scenario for the SPA showing a `pending-revisit` state between `trigger-revisit` classification and the actual `haiku_revisit` invocation on the next tick (the eventual-consistency gap is visible to the user, not hidden).
7. **Trust + Audit (DEC-9)** — `agent-writes-on-behalf-of-human.feature` must include a scenario asserting the audit log records: who initiated the write (agent identity), the human request that triggered it (verbatim chat snippet or session id), the target path, the resulting SHA, and the timestamp. This is the AC-G* item unit-01 added for DEC-9 closure.
8. **Marker clearing on addressed (not closed)** — `silent-filesystem-drop-detection.feature` must include a scenario asserting that a baseline marker is cleared when the corresponding feedback transitions to `addressed` (mid-state in the lifecycle), NOT only when it reaches `closed`. This was a documented inconsistency between SPA-UI-SPECS and ARCHITECTURE that unit-01 resolved.

A scenario that names a canonical term in passing does NOT satisfy these requirements — the term must be load-bearing in a Given/When/Then step that the step-definition layer would actually exercise.

## Completion Criteria

- All 5 .feature files exist at the declared output paths and parse cleanly with Cucumber's official Gherkin parser
- Each .feature file has at least one error / negative scenario in addition to happy-path scenarios
- Every reconciliation requirement above is met with a load-bearing scenario (not a passing mention)
- Step phrasing is consistent across files for the same underlying action — the same Given step phrasing for "a tracked surface baseline exists for stage <stage>" appears identically in any file that uses it
- Actors are named roles (`Designer`, `Product Owner`, `User`, `Reviewer`, `Agent`, `Workflow Engine`) — never bare `user`
- Scenario Outlines are used wherever the behavior is parameterized (per-stage upload availability, change_kind matrix, outcome matrix)
- Each AC-G* general rule and AC-EE* edge case from `product/ACCEPTANCE-CRITERIA.md` has at least one matching scenario; the mapping is the responsibility of unit-04 coverage-validation, but unit-02 must not knowingly leave any AC unmapped
- No feature file inlines schema definitions or HTTP/MCP request shapes — those belong in `DATA-CONTRACTS.md` (cite by reference using the canonical schema name, e.g. `ManualChangeAssessment`)
- No feature file inlines design decisions or architectural rationale — feature files are behavioral, not justificatory; rationale belongs in `DESIGN-DECISIONS.md`
- The five canonical enums (change_kind values, author_class values, outcome values, surface kinds, lifecycle states) match the unit-03 `DATA-CONTRACTS.md` exactly — if unit-03 changes a value, this unit's deliverables must change too
