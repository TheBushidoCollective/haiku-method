# BLUE-TEAM-VERIFICATION.md — Unit-04 Synthesis-Layer Defense Verification

Companion to `THREAT-MODEL.md` (synthesis), `ASSESSMENTS.md` (audit
trail), `SECURITY-CONTROLS-VERIFICATION.md` (independent re-verification),
and `RED-TEAM-VERIFICATION.md` (red-team findings on the synthesis prose).
This file is the **blue-team-hat output for unit-04** — defensive controls
that close the synthesis-prose vulnerability class the red-team surfaced
in FB-11 and FB-12.

**Verifying hat:** `blue-team` (unit-04, bolt 1)
**Verification timestamp (UTC):** 2026-05-03T09:31:44Z
**Worktree:** `.haiku/worktrees/out-of-band-human-file-modifications/unit-04-threat-model-and-assessments`
**Worktree HEAD at hat start:** `ca2cbef0b` (red-team output)

---

## 1. Threat coverage

### Vulnerability class addressed

**Class:** Synthesis-layer prose makes a falsifiable claim about an
identifier (env var, telemetry signal, function name, constant, default
value) without an automated grep-back to source of truth. Visual review
passes; first one-line `grep` against the actual code falsifies it.

**Specific instances (from red-team FB):**

| FB | Surface | Fabrication | Severity |
|---|---|---|---|
| FB-11 | THREAT-MODEL.md §5 | Cites env var `HAIKU_DRIFT_DETECTION=0` as drift-gate kill-switch; reality is `settings.drift_detection === false` field with telemetry `haiku.drift.gate.kill_switch_hit` | HIGH |
| FB-12 | THREAT-MODEL.md §6.1 + §3.5 D-3 | Cites fastify `connectionTimeout` default of 60 s as slowloris mitigation; reality is fastify default `0` (no timeout) with no override in `http.ts` | HIGH |

**Anti-pattern the blue-team must NOT take:** patch the *specific* prose
fragments named in FB-11/FB-12 and call it done. Blue-team mandate explicitly
forbids "patch the specific payload used in testing instead of the
vulnerability class." Below records the class-level fix.

---

## 2. Controls landed (this hat, this bolt)

### Control 1 — Corrected prose (FB-11)

`THREAT-MODEL.md §5` ("`guard-workflow-fields` PreToolUse-bypass class")
now cites:

- `settings.drift_detection === false` at
  `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:5`
- Telemetry signal `haiku.drift.gate.kill_switch_hit` at
  `drift-detection-gate.ts:403`
- Explicit negation of `HAIKU_DRIFT_DETECTION` (no such env var; grep
  returns zero matches)

The deferred residual (operator-alert if the kill-switch fires) now points
implementers at the real telemetry signal so the alert wires to a real
event, not a non-existent env-var override.

### Control 2 — Corrected prose (FB-12) — slowloris escalation

`THREAT-MODEL.md §6.1` (`@fastify/multipart` slowloris bullet) now reads
**"Mitigation in place: NONE"** — retracting the fictional 60-second
`connectionTimeout` claim. `THREAT-MODEL.md §3.5 D-3` Notes cell mirrors
the retraction. `ASSESSMENTS.md §4 R-3` escalates the rate-limit residual
risk severity from "Medium → Low today" to "Medium-High → Medium today"
because slowloris is now an unmitigated risk, not a deferred enhancement,
and adds a fix-unit directive: set `connectionTimeout` (suggested
30 000 ms) and `requestTimeout` (suggested 60 000 ms) on the
`Fastify({ ... })` call in `packages/haiku/src/http.ts:107-136` plus a
paired regression test that asserts a stalled multipart upload is killed
within the timeout.

### Control 3 — Vulnerability-class regression test (root-cause defense)

`artifacts/verify-prose-claims.sh` is the regression-test mechanism that
addresses the *class*, not just FB-11 / FB-12. Every grep-able prose
claim in THREAT-MODEL.md and ASSESSMENTS.md is mechanically validated:

- **Stage-local / repo-wide identifiers** — checked against current HEAD
  (`drift-detection-gate.ts`, `tunnel.ts`, `http.ts`).
- **Sibling-unit identifiers** — checked via `git show <sha>:<path>`
  against the unit branch tips named in the synthesis prose
  (`f83f45fe5` unit-01, `fe91e1e64` unit-02, `06cbb625c` unit-03).
- **Negative-grep guards** — `HAIKU_DRIFT_DETECTION`,
  `connectionTimeout|requestTimeout|keepAliveTimeout` — fail the script
  if any future change re-introduces the fabricated identifier or makes
  the negative-prose claim ("no such env var", "no timeout configured")
  false. (Note: a positive `connectionTimeout` would be *good news* —
  slowloris would become mitigated — but the prose MUST be updated to
  match, so the test correctly forces re-verification.)

Exit code 0 = every claim verified. Non-zero = synthesis prose has
drifted from source of truth and MUST be corrected before the stage
advances.

### Control 4 — Attack-replay regression test (mandate-explicit)

The blue-team hat mandate requires "regression tests that reproduce the
original attack." `artifacts/verify-prose-claims-attack-replay.sh`
implements that literally:

- **Replay 1**: greps the corrected `THREAT-MODEL.md` for the original
  `HAIKU_DRIFT_DETECTION=0` text — fails the script if FB-11's exact
  fabrication is still present.
- **Replay 2**: greps for the original `connectionTimeout (60 s)` text —
  fails the script if FB-12's exact fabrication is still present.
- **Replay 3**: synthesises a temp source tree containing
  `HAIKU_DRIFT_DETECTION` and confirms the negative-grep check would
  fire.
- **Replay 4**: synthesises a temp source tree containing
  `connectionTimeout: 60000` and confirms the negative-grep check would
  fire.

This proves the regression test reproduces the attacks the red team
previously hand-executed. If a future author drifts the prose back into
fabrication, the script fires.

---

## 3. Gate evidence (per-control)

The hat ran each gate before recording it. Evidence triples below match
the ASSESSMENTS.md `gate_pass_evidence` column shape (commit SHA, run
timestamp, exit code).

| Gate | Command | SHA at run | Run timestamp (UTC) | Exit | Notes |
|---|---|---|---|---|---|
| C1 — FB-11 prose corrected | `grep -E 'settings\.drift_detection' THREAT-MODEL.md && ! grep -E 'HAIKU_DRIFT_DETECTION=0' THREAT-MODEL.md` | (uncommitted at hat start; `ca2cbef0b` is parent) | 2026-05-03T09:31:44Z | 0 | Both positive + negative greps PASS. |
| C2 — FB-12 prose corrected | `grep -E 'Mitigation in place: NONE' THREAT-MODEL.md && ! grep -E 'connectionTimeout.*60[[:space:]]*s' THREAT-MODEL.md` | (uncommitted at hat start; `ca2cbef0b` is parent) | 2026-05-03T09:31:44Z | 0 | Both positive + negative greps PASS. |
| C3 — verify-prose-claims.sh | `bash artifacts/verify-prose-claims.sh` | `ca2cbef0b` (worktree HEAD at run time) | 2026-05-03T09:31:44Z | 0 | 15 PASS, 0 FAIL, 1 SKIP (skip is the unit-02 unmerged check, authoritative at-SHA evidence already PASSED). |
| C4 — attack-replay regression | `bash artifacts/verify-prose-claims-attack-replay.sh` | `ca2cbef0b` (worktree HEAD at run time) | 2026-05-03T09:31:44Z | 0 | All 4 replays PASS — corrected prose blocks the original attack vectors and synthesised re-introductions are correctly caught by the negative-grep design. |

The hat MUST execute each gate command at write time and capture its
output before recording closed — same contract as the threat-modeler hat
applied to ASSESSMENTS.md §2. Above table satisfies that contract for
the four blue-team controls.

---

## 4. Monitoring coverage

The blue-team hat anti-pattern list mandates "MUST NOT implement security
controls without testing them" and "validate monitoring coverage for
security events." The synthesis layer does not emit runtime telemetry
itself — it's a documentation surface — but the controls reference
runtime telemetry signals whose monitoring coverage is a deferred-risk
recommendation in ASSESSMENTS.md.

### 4.1. `haiku.drift.gate.kill_switch_hit` (FB-11 reference)

- **Source**: `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:403`
- **Verified present**: `verify-prose-claims.sh` PASS — telemetry signal
  exists at the cited path / line.
- **Monitoring coverage today**: signal is emitted but no alert is wired
  to it. ASSESSMENTS.md §4 R-1 / FB-08 follow-up wave is the place where
  the alert wiring lands. The corrected §5 prose now points implementers
  at the real signal name, removing the FB-11 implementation-blocker.

### 4.2. Slowloris detection (FB-12 reference)

- **Source**: no detection signal exists today. The corrected §6.1 prose
  acknowledges this explicitly ("Mitigation in place: NONE").
- **Monitoring coverage today**: zero. The fix-unit directive in
  ASSESSMENTS.md §4 R-3 names the implementation lift (set
  `connectionTimeout` + `requestTimeout` on `Fastify({ ... })` plus
  paired regression test that asserts a stalled multipart upload is
  killed within the timeout).
- **Rationale for not landing the runtime fix in unit-04**: the unit
  spec scope is "two synthesis artifacts" — the load-bearing decision
  was option (a) in FB-12's diagnosis, "documentation-only retraction
  with rate-limit work tracked under R-3 / FB-08." Landing
  `connectionTimeout` + a paired test belongs in the rate-limiting fix
  unit, not in a synthesis-doc correction. (Hat-mandate boundary: this
  hat documents existing controls and identifies gaps; landing new
  HTTP-server config is implementation work owned by `unit-05-rate-limiting`.)

### 4.3. Synthesis-prose drift (FB-11 / FB-12 class)

- **Detection**: `verify-prose-claims.sh` exit code. Run on every
  security-stage advance; non-zero exit blocks the gate.
- **Coverage**: 15 named identifier claims across §1.3, §1.4, §3.1,
  §3.2, §3.5, §3.6, §4.x, §5, §6.1, §7. Both negative-grep guards
  (FB-11, FB-12) are in the script. Exit 0 today.
- **Recommended integration**: add the script invocation to the security
  stage's `quality_gates:` frontmatter so the workflow engine runs it on
  every blue-team / feedback-assessor pass. (Doc-only recommendation;
  the workflow-engine wiring lands in a follow-up unit.)

---

## 5. Disposition

### Findings closed by this hat

- **FB-11 (HIGH)** — addressed via Control 1 (corrected §5 prose) +
  Control 3 (regression test that prevents re-introduction). The
  red-team rejection note explained the FB had been rejected for routing
  reasons (the artifact didn't exist on the fix-chain branch); on this
  unit-04 worktree where the artifact lives, the corrective edit lands
  cleanly.
- **FB-12 (HIGH)** — addressed via Control 2 (corrected §6.1 + §3.5
  prose, escalated R-3 in ASSESSMENTS.md) + Control 3 (regression test).
  Slowloris runtime fix deferred to `unit-05-rate-limiting` per the
  fix-unit directive recorded in ASSESSMENTS.md §4 R-3.

### Findings deferred (not blue-team scope this bolt)

- The runtime `connectionTimeout` + `requestTimeout` config on
  `Fastify({ ... })` and its paired stalled-multipart regression test —
  belongs in the rate-limiting fix unit per ASSESSMENTS.md §4 R-3.
- Wiring an operator alert to `haiku.drift.gate.kill_switch_hit` —
  belongs in ASSESSMENTS.md §4 R-1 follow-up wave.

### Hat handoff

- All four gates pass at the timestamps recorded in §3.
- `haiku_unit_advance_hat` invoked at end of bolt — the next hat
  (per stage `hats:` rotation) inherits the corrected synthesis
  artifacts and the regression-test mechanism.

---

## 6. References

- `THREAT-MODEL.md` — synthesis (this stage), corrected §5 + §6.1 + §3.5 D-3
- `ASSESSMENTS.md` — audit trail (this stage), escalated §4 R-3
- `SECURITY-CONTROLS-VERIFICATION.md` — security-engineer hat output
- `RED-TEAM-VERIFICATION.md` — red-team hat output (the source of FB-11 / FB-12)
- `verify-prose-claims.sh` — vulnerability-class regression test
- `verify-prose-claims-attack-replay.sh` — attack-replay regression test
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` —
  FB-11 source-of-truth (kill-switch field + telemetry signal)
- `packages/haiku/src/http.ts` — FB-12 source-of-truth (no
  `connectionTimeout` override)
- Unit branch tips: `f83f45fe5` (unit-01), `fe91e1e64` (unit-02),
  `06cbb625c` (unit-03) — sibling-unit identifier sources
