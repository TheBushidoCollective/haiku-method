---
title: Acceptance criteria
model: opus
inputs:
  - intent.md
  - knowledge/DISCOVERY.md
  - knowledge/DESIGN-DECISIONS.md
  - stages/design/artifacts/ARCHITECTURE.md
  - stages/design/artifacts/SPA-UI-SPECS.md
  - stages/design/artifacts/MCP-TOOL-CONTRACT.md
  - stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md
  - stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md
  - product/ACCEPTANCE-CRITERIA.md
outputs:
  - >-
    .haiku/intents/out-of-band-human-file-modifications/product/ACCEPTANCE-CRITERIA.md
status: completed
bolt: 3
hat: validator
started_at: '2026-04-29T02:43:18Z'
hat_started_at: '2026-04-29T03:09:51Z'
iterations:
  - hat: product
    started_at: '2026-04-29T02:43:18Z'
    completed_at: '2026-04-29T02:52:42Z'
    result: advance
  - hat: specification
    started_at: '2026-04-29T02:52:42Z'
    completed_at: '2026-04-29T02:58:47Z'
    result: advance
  - hat: validator
    started_at: '2026-04-29T02:58:47Z'
    completed_at: '2026-04-29T03:00:26Z'
    result: reject
    reason: >-
      Three variant dimensions have only 1 AC entry each; unit completion
      criterion requires ≥2 per dimension. Gaps: (1) stage-of-ownership:current
      — AC-CO1 is the only entry; needs a second AC (e.g. positive assertion on
      what ignore/inline-fix look like for current-stage drift, or assessment
      record contents); (2) classification-outcome:ignore — AC-CI1 is the only
      entry; needs a second AC (e.g. next-tick behavior showing no re-drift, or
      behavior on deleted-file ignore); (3) classification-outcome:inline-fix —
      AC-IF1 is the only entry; needs a second AC (e.g. what inline-fix produces
      in the assessment record, or inline-fix behavior on earlier-stage drift
      that is distinct from AC-EO2 which lives in the stage-of-ownership
      section). All other criteria pass: DEC-9 closure correct,
      surface-as-feedback baseline contract correct, awaiting-revisit-resolution
      state present, outputs/artifacts alias covered, addressed-vs-closed
      terminal state correct, ≥13 general rules, ≥7 edge cases including AC-EE7
      at P1, all ACs are Given/When/Then-expressible, design decisions cited, no
      contradictions with upstream artifacts.
  - hat: specification
    started_at: '2026-04-29T03:00:26Z'
    completed_at: '2026-04-29T03:03:02Z'
    result: advance
  - hat: validator
    started_at: '2026-04-29T03:03:02Z'
    completed_at: '2026-04-29T03:05:28Z'
    result: reject
    reason: >-
      Coverage validation found a phantom citation: AC-G5-A and AC-TR1 cite
      ARCHITECTURE.md §5.5 as the authority for the
      `awaiting-revisit-resolution` active-stage state, but ARCHITECTURE.md has
      only §5.1–§5.4 and never defines that state, term, or section. The
      producer hat invented the citation to satisfy unit completion-criterion #7
      instead of routing the gap back. Two valid paths forward: (a) raise
      feedback/revisit against the design stage to add §5.5 (active-stage state
      during pending revisit) to ARCHITECTURE.md, then re-cite, or (b) demote
      AC-G5-A and the §5.5 line in AC-TR1 to an Open/Deferred placeholder
      mirroring AC-UO1 with explicit "pending design clarification" framing.
      Secondary gap: AC-UO1 has 1 entry under the unit-output tracked-surface
      variant where the unit spec requires ≥2 per dimension; same Open/Deferred
      treatment acceptable but should be called out. Everything else (≥10
      General Rules, 7 edge cases incl. AC-EE7, Trust+Audit AC-TA1..TA4
      replacing AC-AB4, alias canonicalization AC-ALIAS1..3, surface-as-feedback
      baseline-not-updated wording across AC-G4/SF1/SF2/SF3/TR1,
      addressed≠terminal in AC-G5/SF3, DEC-N citations, Given/When/Then format,
      sibling-deferral) checks out and 59KB easily clears the 8KB minimum.
  - hat: specification
    started_at: '2026-04-29T03:05:28Z'
    completed_at: '2026-04-29T03:09:51Z'
    result: advance
  - hat: validator
    started_at: '2026-04-29T03:09:51Z'
    completed_at: '2026-04-29T03:11:14Z'
    result: advance
model_original: sonnet
completed_at: '2026-04-29T03:11:14Z'
---
# Acceptance criteria

Ratify and complete the product-stage `ACCEPTANCE-CRITERIA.md` (already drafted by discovery at `product/ACCEPTANCE-CRITERIA.md`). The discovery wrote a strong scaffold; this unit closes specific reconciliation gaps the pre-execute review surfaced — DEC-9 stance, `surface-as-feedback` baseline contract, pending-revisit active-stage transition, `outputs/` vs `artifacts/` alias.

## Reconciliation gaps to close (READ FIRST)

The pre-execute review on this unit surfaced cross-document inconsistencies that must be resolved here:

1. **DEC-9 closure (Trust+Audit stance).** AC-AB4 currently says the Decision-9 stance is deferred. DEC-9 is now resolved: v1 ships **Trust+Audit** (agent can call the human-write tool freely; git blame is the audit trail). Replace AC-AB4 with concrete acceptance criteria that assert: (a) the agent's invocation does not require an interrupt-driven human confirmation in v1, (b) every invocation appends to a per-intent audit log, (c) the audit log is human-readable and append-only.
2. **`surface-as-feedback` baseline behavior.** ARCHITECTURE.md §5.4 says: when the agent classifies a finding as `surface-as-feedback`, the baseline is **NOT** updated at classification time. A pending-assessment marker is written instead. The marker clears (and the baseline updates) only when the linked feedback transitions to a terminal state. AC-G4 / AC-SF* must reflect this exactly — no AC may say "baseline updated immediately on surface-as-feedback".
3. **Pending-revisit active-stage transition.** AC-G5 currently describes marker clearing but does not specify the active-stage state while a `trigger-revisit` marker is open. Add an AC stating: when a `trigger-revisit` marker is open against an upstream stage, the active stage transitions to `awaiting-revisit-resolution` (or the equivalent state ARCHITECTURE.md §5.5 names). The marker clears when the revisited stage's gate re-passes.
4. **`outputs/` vs `artifacts/` alias.** TRACKED-SURFACE-BOUNDARY.md §0 declares `artifacts/` canonical and `outputs/` an alias. Add an AC asserting: any AC, scenario, or contract that uses `stages/{stage}/outputs/` is implementation-equivalent to `stages/{stage}/artifacts/`; new code MUST write to `artifacts/`.
5. **`addressed` vs `closed` for marker clearing.** ARCHITECTURE.md §5.3 lists terminal states for marker clearing. Existing FB lifecycle has `addressed` distinct from `closed`. AC-G5 currently includes both; clarify which transition triggers marker clearing — pick the conservative path: `closed` and `rejected` clear; `addressed` does NOT (because addressed FBs can still be reopened).

## Scope

ACCEPTANCE-CRITERIA.md must cover:

- **General rules (AC-G*)** — pre-tick gate fires `manual_change_assessment`; agent owns classification; baseline-update contract per the four outcomes (terminal updates immediately, non-terminal writes pending-assessment marker); existing PreToolUse hook policy invariant; first-tick-after-upgrade silence; eventual-consistency model
- **Variant ACs** — per dimension: write-path origin, tracked-surface class, payload type, stage-of-ownership, classification outcome
- **Edge cases & error paths (AC-EE*)** — same-tick race, deletions, off-surface writes, baseline corruption, classification timeout, double-edit while marker open, SPA override (AC-EE7 even at P1)
- **Trust+Audit AC (replaces AC-AB4)** — DEC-9 resolved
- **`outputs/` vs `artifacts/` AC** — alias canonicalization
- **Active-stage state during pending-revisit** — workflow transition spec
- **Prioritization** — P0 / P1 / Open-for-design

## Completion Criteria

- ACCEPTANCE-CRITERIA.md exists at `product/ACCEPTANCE-CRITERIA.md` and is at least 8KB of substantive prose
- ≥10 General Rule entries (AC-G1+) covering system-wide invariants
- Variant AC sections for each dimension (write-path origin, tracked-surface class, payload type, stage-of-ownership, classification outcome) — each with ≥2 entries
- ≥7 Edge case / error path entries (AC-EE1..AC-EE7+); AC-EE7 (SPA classification override) is present even though it is P1
- AC-AB4 removed and replaced with concrete Trust+Audit acceptance criteria for DEC-9 (audit log append, no interrupt confirmation in v1, human-readable + append-only audit log)
- AC explicitly states `surface-as-feedback` does NOT update baseline at classification time — verifiable by grep against the file: every AC that mentions `surface-as-feedback` either says "baseline NOT updated" or cites the pending-marker mechanism
- AC explicitly states the active-stage transition during a pending `trigger-revisit` marker (whatever ARCHITECTURE.md §5.5 names — `awaiting-revisit-resolution` or equivalent)
- AC explicitly documents the `outputs/` → `artifacts/` alias canonicalization rule
- AC explicitly states which feedback statuses (closed / rejected) clear pending-assessment markers and which (addressed) do NOT
- Every AC entry follows a Given/When/Then-expressible shape OR explicitly cites the .feature scenario that demonstrates it
- Every AC entry that addresses a recorded design decision (DESIGN-DECISIONS.md DEC-1..DEC-9) cites the decision number explicitly
- File is internally consistent with design-stage artifacts: no AC contradicts ARCHITECTURE.md gate ordering, MCP-TOOL-CONTRACT.md tool semantics, or TRACKED-SURFACE-BOUNDARY.md path rules
- File defers to sibling product artifacts at appropriate boundaries — no inline schemas (DATA-CONTRACTS.md), inline scenarios (.feature files), or inline coverage tables (COVERAGE-MAPPING.md)
