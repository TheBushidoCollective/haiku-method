---
title: Coverage validation
model: sonnet
depends_on:
  - unit-01-acceptance-criteria
  - unit-02-behavioral-specs
  - unit-03-data-contracts
inputs:
  - intent.md
  - knowledge/COVERAGE-MAPPING.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
outputs:
  - >-
    .haiku/intents/out-of-band-human-file-modifications/product/COVERAGE-MAPPING.md
status: completed
bolt: 1
hat: validator
started_at: '2026-04-29T03:23:34Z'
hat_started_at: '2026-04-29T03:37:26Z'
iterations:
  - hat: product
    started_at: '2026-04-29T03:23:34Z'
    completed_at: '2026-04-29T03:30:32Z'
    result: advance
  - hat: specification
    started_at: '2026-04-29T03:30:32Z'
    completed_at: '2026-04-29T03:37:26Z'
    result: advance
  - hat: validator
    started_at: '2026-04-29T03:37:26Z'
    completed_at: '2026-04-29T03:39:35Z'
    result: advance
completed_at: '2026-04-29T03:39:35Z'
---
# Coverage validation

Promote the coverage-mapping discovery artifact (`knowledge/COVERAGE-MAPPING.md`) into the product-stage canonical location at `product/COVERAGE-MAPPING.md` and validate that every success criterion from the upstream specs has matching artifacts in the product stage's outputs. This unit is the product stage's terminal traceability check: if any AC, .feature scenario, or DATA-CONTRACTS entity is missing or orphaned, the gate doesn't open.

## Scope

`product/COVERAGE-MAPPING.md` must contain:

- **Full coverage matrix** — one row per success criterion (SC-N) sourced from intent goal, `DESIGN-DECISIONS.md` (DEC-1..DEC-9), and design unit completion criteria (DESN-01..DESN-06). Every SC-N row maps to:
  - The AC-G* general-rule or AC-EE* edge-case entry in `product/ACCEPTANCE-CRITERIA.md` that asserts it
  - The `.feature` scenario(s) in `.haiku/intents/{slug}/features/*.feature` that demonstrate it
  - The DC-N entity/contract in `product/DATA-CONTRACTS.md` that schemas it (when applicable — non-data SCs may have empty DC column)
- **Orphan detection** — every AC, scenario, and DC entry must trace back to at least one SC-N. Orphans are flagged as either spec-creep (drop) or missing-SC (add).
- **Gap detection** — every SC-N must have at least one AC, one scenario, and (when applicable) one DC entry. Gaps are blockers.
- **Out-of-scope dispositions** — explicit list of SCs intentionally deferred to later stages (development, operations, security) with disposition rationale
- **Validation outcome** — terminal section: `APPROVED` (no gaps, no orphans) or `GAPS FOUND` (list of unblock conditions)

## Reconciliation requirements (must be enforced before this unit can complete)

The pre-execute review found that the discovery draft used a different identifier scheme than unit-01 settled on. This unit must rewrite the matrix using the canonical scheme.

1. **AC-G* / AC-EE* identifier scheme** — `product/COVERAGE-MAPPING.md` MUST reference acceptance criteria using the `AC-G<N>` (general rule) and `AC-EE<N>` (edge case) identifiers from unit-01's `product/ACCEPTANCE-CRITERIA.md`, NOT a flat `AC-N` numbering. Every row's AC column must point to a real `AC-G*` or `AC-EE*` ID that exists in `product/ACCEPTANCE-CRITERIA.md`. If the discovery draft uses flat `AC-N`, rewrite the entire matrix.
2. **Canonical enum cross-check** — the matrix must include rows for the three canonical enums (`change_kind`, `author_class`, outcome) showing each has SC coverage, an AC-G* assertion, ≥1 scenario per enum value, and a DC entry pinning the values. If any enum value is missing scenario coverage, that's a `GAPS FOUND` blocker.
3. **DEC-9 (Trust + Audit) coverage** — at least one SC row must trace to a DEC-9-derived AC-G*, ≥1 scenario in `agent-writes-on-behalf-of-human.feature`, and the `Assessment.initiated_by` / `triggering_request` / `target_path` / `resulting_sha` / `recorded_at` audit fields in DATA-CONTRACTS.md.
4. **Surface-as-feedback baseline contract coverage** — at least one SC row must trace to AC-G7 (or whichever AC-G* unit-01 used to encode it), ≥1 scenario in `manual-change-assessment.feature`, and the atomic-baseline-update language in DATA-CONTRACTS.md.
5. **Pending-revisit transition coverage** — at least one SC row must trace to the AC-G* covering the SPA pending-revisit state, ≥1 scenario in `drift-assessment-visibility.feature`, and the `Assessment.revisit_invoked_at` field definition in DATA-CONTRACTS.md.
6. **Outputs/artifacts alias coverage** — at least one SC row must trace to AC-G* or AC-EE* covering both directory aliases, ≥1 scenario in `silent-filesystem-drop-detection.feature`, and the explicit alias paragraph in DATA-CONTRACTS.md's `tracked_file` schema.
7. **Marker clearing on `addressed` (not `closed`) coverage** — at least one SC row must trace to AC-G* covering the lifecycle, ≥1 scenario in `silent-filesystem-drop-detection.feature`, and the `haiku_baseline_clear_marker` trigger contract in DATA-CONTRACTS.md.

If any of these reconciliations cannot be made — because unit-01, unit-02, or unit-03 didn't actually deliver the expected substance — this unit returns `GAPS FOUND` with that as the unblock condition. It must not paper over upstream gaps.

## Completion Criteria

- `product/COVERAGE-MAPPING.md` exists and is at least 5KB of substantive prose
- File contains a coverage matrix with ≥6 capability domains and ≥40 SC-N rows (Detection, Classification & Response, Write Paths, Tracked Surface & Rollout, User-Visible SPA Signals, Cross-cutting & Non-functional)
- Every row has populated AC column referencing a real `AC-G<N>` or `AC-EE<N>` from `product/ACCEPTANCE-CRITERIA.md` (or explicit `deferred to <stage>`)
- Every row has populated feature-scenario column referencing a real scenario name in `features/*.feature` (or explicit `data-only, no scenario`)
- Every row has populated DC column for data-bearing SCs; non-data SCs explicitly state `n/a (no data contract)`
- All 7 reconciliation requirements above are enforced — each cited canonical enum / decision / contract has its full SC → AC → scenario → DC chain present
- Orphan-detection section lists every AC and scenario that doesn't trace to an SC, OR explicitly asserts `no orphans found` with a reproducible verification approach (the verification description, not the command itself — commands are development-stage)
- Gap-detection section lists every SC missing AC/scenario/DC coverage, OR explicitly asserts `no gaps found`
- Out-of-scope dispositions section names every SC intentionally deferred with disposition (`development` / `operations` / `security`) and rationale
- Document ends with a Validation Outcome section that is either `APPROVED` (and explicitly confirms zero gaps + zero orphans across all 7 reconciliation requirements) or `GAPS FOUND` (and lists the blocker conditions)
- File is consistent with the actual on-disk artifacts — no SC references an AC-G*, AC-EE*, scenario name, or DC entity that doesn't exist
