---
title: >-
  contrast-and-type-audit re-truth against live artifacts + automated stage
  quality-gate script + ledger-integrity gate. Closes the meta-finding that
  audit tables reported PASS for failing checks. Adds infrastructure that
  makes false-closures structurally impossible — every closure requires the
  gate script to return 0, and every `closed_by: unit-*` must point to a
  unit file that exists on disk
type: design
closes:
  - FB-137
  - FB-151
  - FB-152
depends_on:
  - unit-26-artifact-opacity-and-banned-pair-sweep
  - unit-27-palette-and-sizing-magic-number-normalization
  - unit-28-typography-floor-pairing-sweep
  - unit-29-stage-progress-strip-button-rewrite
  - unit-30-feedback-inline-mobile-reduced-motion-guard
  - unit-31-feedback-list-semantics-parity
  - unit-32-component-inventory-and-canonical-names
  - unit-33-feedback-summary-bar-artifact
inputs:
  - stages/design/
outputs:
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/hats/design-reviewer.md
  - stages/design/hats/feedback-assessor.md
  - stages/design/scripts/quality-gates.sh
  - stages/design/scripts/ledger-integrity-check.sh
  - stages/design/artifacts/unit-34-design-review.md
quality_gates:
  - name: quality-gates-script-exists
    command: "test -x .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/scripts/quality-gates.sh"
  - name: ledger-integrity-script-exists
    command: "test -x .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/scripts/ledger-integrity-check.sh"
  - name: quality-gates-script-runs-clean
    command: "bash .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/scripts/quality-gates.sh run_all"
  - name: ledger-integrity-clean
    command: "bash .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/scripts/ledger-integrity-check.sh"
  - name: design-reviewer-hat-requires-gate-scripts
    command: "grep -E 'quality-gates\\.sh|ledger-integrity-check\\.sh' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/hats/design-reviewer.md"
  - name: feedback-assessor-hat-requires-gate-scripts
    command: "grep -E 'quality-gates\\.sh|ledger-integrity-check\\.sh' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/hats/feedback-assessor.md"
  - name: audit-tables-cite-grep-not-prose
    command: "python3 -c \"import sys; c = open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/contrast-and-type-audit.md').read(); required = ['grep', 'quality-gates.sh']; missing = [x for x in required if x not in c]; sys.exit(1 if missing else 0)\""
  - name: false-closure-regression-history-documented
    command: "grep -iE 'false[- ]closure|ghost[- ]unit|regression history' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/hats/design-reviewer.md"
---
# Audit re-truth, automated quality-gate infrastructure, and ledger-integrity gate

## Scope

Three meta-findings with the same root cause: the quality-gate apparatus
was unreliable, so false closures passed the gate and continued shipping
broken markup.

- **FB-137** — Systemic false-closure: 18+ feedback items cited
  `closed_by: unit-26..31` for units that never existed on disk. The
  fix-loop advanced `status: closed` without verifying the referenced
  unit shipped. Every adversarial cycle after that trusted the closed
  status and missed live regressions.
- **FB-151** — `contrast-and-type-audit.md §6.2 / §6.3` tables reported
  PASS for checks that failed when run live. The audit doc became a
  cache of aspirational fix states, not an observable truth. Multiple
  findings (FB-71, FB-86, FB-92, FB-94, FB-97, FB-108) got closed on
  audit-prose proof, not markup proof.
- **FB-152** — Ghost-unit ledger repair record. Prior cycles flipped
  45 items from closed back to pending when the ghost-unit pattern was
  detected. Orchestrator guard added to reject `closed_by: unit-N-*`
  when the unit spec is missing. haiku_revisit handler also fixed
  (parse-once bug). Closure of FB-152 requires verification that the
  repair landed and stays landed.

The fix across all three is infrastructure: automated gate scripts that
the review hats MUST run, whose output becomes the source of truth
instead of the audit document.

## Approach

**This unit runs LAST in the revisit sequence** — it depends on unit-26
through unit-33 landing their artifact fixes, because the audit re-truth
and the gate-run outputs need to reflect the post-fix state.

**Designer hat:**

1. **Author `stages/design/scripts/quality-gates.sh`** — the canonical
   gate script covering qg1 through qg10 enumerated in `quality_gates`.
   Each function is a small shell snippet; `run_all` dispatches them
   and prints PASS / FAIL per gate plus a final exit code.
2. **Author `stages/design/scripts/ledger-integrity-check.sh`** — the
   FB-137 gate. Walks every feedback file, extracts `closed_by:`, and
   verifies the unit file exists. Non-existent references print
   `GHOST-CLOSURE:` and the script exits non-zero.
3. **Re-truth `contrast-and-type-audit.md §6.1 / §6.2 / §6.3`** — delete
   every PASS-without-count row. Replace each with the exact grep
   command, the post-fix count, and a timestamp. The audit becomes a
   record of what the scripts returned, not an aspirational claim.
4. **Update `design-reviewer.md` hat spec** — add a new section at the
   top: "Gate scripts — MUST run first". Lists the two scripts and the
   requirement that a failing script immediately fails the review.
   Explicitly calls out that audit prose is NOT a substitute. Adds the
   "False-closure regression history" section.
5. **Update `feedback-assessor.md` hat spec** — same script-runner
   requirement. Closure of any a11y / consistency finding requires the
   relevant gate to return 0. If the gate fails, the assessor cannot
   mark the finding closed; it stays pending.
6. **Run both scripts against the post-unit-33 tree** — capture output
   into `unit-34-design-review.md` as the closure evidence.
7. **Close FB-152** with the ledger-integrity-check.sh output as proof.

**Design-reviewer hat:**

- Run `quality-gates.sh run_all` — every gate must pass.
- Run `ledger-integrity-check.sh` — must return 0.
- Walk `contrast-and-type-audit.md §6` — every row cites a grep
  command and the post-run count, no standalone PASS claims.
- Walk `design-reviewer.md` + `feedback-assessor.md` — script-runner
  section present and prominent.

**Feedback-assessor hat:**

- Run both scripts.
- Confirm FB-137, FB-151, FB-152 closure is backed by script output,
  not prose.
- Confirm the "False-closure regression history" section is in place
  so future iterations inherit the lesson.

## Completion criteria

- [ ] `quality-gates.sh` authored with qg1-qg10
- [ ] `ledger-integrity-check.sh` authored and returns 0 against current
      tree
- [ ] `contrast-and-type-audit.md §6` tables re-truthed against live
      output
- [ ] `design-reviewer.md` hat spec requires running both scripts first
- [ ] `feedback-assessor.md` hat spec requires script output as closure
      proof
- [ ] unit-34 design-review artifact captures both script outputs
- [ ] FB-137, FB-151, FB-152 close on script-output verification
