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
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/hats/design-reviewer.md
  - stages/design/hats/feedback-assessor.md
  - stages/design/artifacts/motion-and-reduced-motion-spec.md
  - stages/design/feedback/
  - stages/design/units/
outputs:
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/hats/design-reviewer.md
  - stages/design/hats/feedback-assessor.md
  - stages/design/artifacts/quality-gates.sh
  - stages/design/artifacts/ledger-integrity-check.sh
  - stages/design/artifacts/unit-34-design-review.md
quality_gates:
  - >-
    `contrast-and-type-audit.md §6.1, §6.2, §6.3` tables regenerated from
    live grep output. Every PASS declaration replaced with the actual
    live count (after unit-26 / unit-27 / unit-28 land, every count
    should be 0; unit-34 runs LAST in the sequence to capture the true
    post-fix state). The audit doc NO LONGER contains prose like
    "Remaining instances are ALL paired with..." — it cites the
    grep command and its output.
  - >-
    `stages/design/artifacts/quality-gates.sh` exists and contains the
    canonical gate suite. Each gate is a named shell function that
    returns 0 on pass and non-zero on fail, with the grep command
    inlined so the source of truth is self-evident. Minimum gates:
    - `qg1_opacity` — `grep -rEn 'opacity-50|opacity-60'
      stages/design/artifacts/*.html | grep -vE 'backdrop-blur|black/50|
      black/60|modal-overlay|demo-only'` → 0 hits.
    - `qg2_banned_pairs` — `grep -rEn 'bg-stone-100[^"]*text-stone-500|
      text-stone-500[^"]*bg-stone-100|bg-stone-200[^"]*text-stone-500|
      text-stone-500[^"]*bg-stone-200' stages/design/artifacts/*.html`
      → 0 hits.
    - `qg3_aria_disabled` — Python3 `aria-disabled` walker from audit §4
      Bolt-4, returns 0 violations.
    - `qg4_palette` — `grep -rn 'gray-' stages/design/artifacts/*.html`
      → 0 hits.
    - `qg5_bare_rounded` — `grep -rEn 'class="[^"]*\brounded\b[^-]'
      stages/design/artifacts/*.html` → 0 hits.
    - `qg6_magic_px` — `grep -rEn 'max-w-\[[0-9]+px\]|w-\[[0-9]+px\]|
      min-h-\[[0-9]+px\]|h-\[[0-9]+px\]|rounded-\[[0-9]+px\]'
      stages/design/artifacts/*.html` → 0 hits (or all remaining tagged
      `demo-only`).
    - `qg7_typography_floor` — `grep -rEn 'text-\[11px\]'
      stages/design/artifacts/*.html | grep -vE 'font-semibold|font-bold'`
      → 0 hits.
    - `qg8_reduced_motion` — stage-wide motion-audit script from
      motion-and-reduced-motion-spec.md §Verification → empty output.
    - `qg9_list_semantics` — `grep -cE '<ul|role="list"'
      stages/design/artifacts/feedback-inline-desktop.html` ≥ 1.
    - `qg10_stage_progress_buttons` — `grep -En '<div[^>]*role="link"'
      stages/design/artifacts/stage-progress-strip.html` → 0 hits.
    The script has a `run_all` dispatch that runs every function and
    prints PASS / FAIL with exit code 0 iff all pass.
  - >-
    `stages/design/artifacts/ledger-integrity-check.sh` exists and
    implements the FB-137 gate. Contents (conceptually):
    ```
    #!/usr/bin/env bash
    set -eu
    missing=0
    for f in stages/design/feedback/*.md; do
      ref=$(awk '/^closed_by:/ {print $2}' "$f")
      [ -z "$ref" ] || [ "$ref" = "null" ] && continue
      ref=${ref#\"}; ref=${ref%\"}
      [ -f "stages/design/units/${ref}.md" ] || {
        echo "GHOST-CLOSURE: $f → ${ref} missing"
        missing=$((missing + 1))
      }
    done
    [ "$missing" -eq 0 ]
    ```
    Script returns 0 only when every `closed_by:` points at an existing
    unit file. Running it against the current tree returns 0 — every
    feedback item whose `closed_by` previously cited unit-26..31 has
    been reopened by the FB-152 repair, OR re-closed by one of unit-26..34
    in this revisit.
  - >-
    `stages/design/hats/design-reviewer.md` updated so the review-agent
    MUST run `quality-gates.sh run_all` AND `ledger-integrity-check.sh`
    as the first step of its review and fail the review immediately if
    either script returns non-zero. The hat spec explicitly calls out
    that prose claims in `contrast-and-type-audit.md` are NOT a
    substitute for the live script output.
  - >-
    `stages/design/hats/feedback-assessor.md` updated with the same
    script-runner requirement. Feedback-assessor closure of any a11y /
    consistency finding REQUIRES the relevant gate to return 0. The
    hat spec explicitly cites the failure mode: "prior iterations
    marked findings closed_by non-existent units and accepted audit
    prose as proof; this iteration requires live grep + existing-unit
    verification, no exceptions."
  - >-
    `FB-152` (ghost-unit ledger repair) closure: `ledger-integrity-check
    .sh` returns 0, confirming the 45 falsely-closed findings were
    properly reopened AND the orchestrator guard (referenced in FB-152
    body) is live. Closure memo in the unit-34 design-review artifact
    documents the state of the ledger at the time of closure: total
    feedback count, closed count, pending count, reopened count.
  - >-
    Pattern prevention documented: `design-reviewer.md` gains a
    "False-closure regression history" section naming iterations 5–7 of
    this intent as the exemplar anti-pattern, and citing the two
    scripts as the structural defense. Future adversarial cycles run
    both scripts first, not prose-inspect.
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

1. **Author `stages/design/artifacts/quality-gates.sh`** — the canonical
   gate script covering qg1 through qg10 enumerated in `quality_gates`.
   Each function is a small shell snippet; `run_all` dispatches them
   and prints PASS / FAIL per gate plus a final exit code.
2. **Author `stages/design/artifacts/ledger-integrity-check.sh`** — the
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
