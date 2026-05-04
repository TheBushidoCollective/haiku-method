# Blue-Team Report — Unit 02 (Author Identity Binding + Status-Check Correctness)

Defensive response to the red-team's findings on the unit-02
implementation that closed V-03 / V-05 / V-06. Scope: land the controls
the red-team flagged as required for unit-02 to be defensibly closed
(R-01, R-02, R-03 — all HIGH), add regression tests that reproduce each
attack pre-fix, and verify the existing controls + the new ones hold
under the full test suite.

The red-team's R-01..R-09 table called out three findings as "Required
for unit-02 to be defensibly closed". Those are the controls landed
here. The remaining MED/LOW findings (R-04..R-09) are out-of-scope per
the red-team's own routing (carry to unit-04 ASSESSMENTS residual risk
or pair with V-03 fix #3).

---

## 1. Controls landed

### R-01 (HIGH) — SPA upload routes accept any valid tunnel JWT for any intent

**File:** `packages/haiku/src/http/auth.ts:53-99`,
`packages/haiku/src/http/upload-routes.ts:69, 219, 502`

**Pre-fix attack.** Both upload routes called only
`requireTunnelAuth(req, reply, null)`, which validates the JWT
signature/expiry but does NOT bind the JWT's `sid` claim to the
`intent` slug in the URL. A tunnel-mode reviewer holding a valid JWT
for review session `S1` (bound to intent `A`) could `POST` files to
`/api/intents/B/uploads/{stage-output|knowledge}` and the server would
write them, attribute them to whatever `attribute_to_user` the attacker
submitted, and stamp both `action-log.jsonl` and `write-audit.jsonl` of
intent `B` with `author_class: "human-via-mcp"`.

**Control.** Mirror the feedback-API surface. Renamed
`verifyFeedbackMutationAuth` → `verifyIntentMutationAuth` (the helper is
generic — it binds the JWT's `sid` to whatever `intent` slug the request
is mutating; "feedback" was a misnomer). Kept `verifyFeedbackMutationAuth`
as a back-compat alias so the feedback-API call sites don't churn. Added
a `verifyIntentMutationAuth(req, reply, intent)` call immediately after
`requireTunnelAuth(...)` on both upload routes.

In local (non-tunnel) mode the helper is a no-op (loopback gates auth) —
matches the existing feedback-API behaviour, so no regression for
non-tunnel deployments.

### R-02 (HIGH) — `haiku_human_write` MCP path retained the V-05 producer bug

**File:**
`packages/haiku/src/tools/orchestrator/haiku_human_write.ts:38-43, 681-697`

**Pre-fix attack.** The MCP tool called
`getCurrentTickCounter(intentDir)` with no `stage` argument, which
falls into a non-deterministic `readdirSync(stagesDir)` for-loop and
returns the FIRST stage's `iteration` value. Loop order is
filesystem-dependent (OS, inode allocation, locale). Two consecutive
intent-scope MCP writes (`knowledge/...`) could share a tick value
drawn from whichever stage `readdirSync` ranked first — and the
resulting `entry_id` could collide with per-stage entries that happen
to share the chosen tick. The drift-gate consumer's per-stage filter
would then drop the `human-via-mcp` provenance entirely and the file
would fall back to `baselineEntry.author_class` (typically `"agent"`).

This is the EXACT failure mode V-05 was filed to fix on the SPA side,
just with the agent holding the gun.

**Control.** Mirror the SPA branch. Parse the stage segment out of the
canonical path (`stages/{X}/...`) and route:

- Intent-scope writes (`knowledge/...`, no `stages/` prefix) →
  `getIntentScopeTickCounter(intentDir)` (deterministic, monotonic,
  persisted to `intent-tick.json`). `tick_scope: "intent"`.
- Stage-scope writes (`stages/{X}/...`) → `getCurrentTickCounter(intentDir, X)`
  with the explicit stage slug (no `readdirSync` lottery).
  `tick_scope: "stage"`.

Both action-log and audit-log entries stamp `tick_scope` consistently
so the drift-gate consumer's union (`readActionLogSync` ∪
`readIntentScopeActionLogSync`) routes the entry into the right read.

### R-03 (HIGH) — `haiku_human_write` ignored `isIntentLocked`

**File:**
`packages/haiku/src/tools/orchestrator/haiku_human_write.ts:38-43, 437-457`

**Pre-fix attack.** The SPA upload routes checked both
`isIntentArchived` AND `isIntentLocked` (returning 404 / 423
respectively). The MCP tool imported `isIntentArchived` only and gated
on archive state alone — `isIntentLocked` was never called. An
operator-locked intent (e.g. mid-revisit, to freeze it for human
inspection) would reject SPA uploads (`intent_locked` 423) but happily
accept `haiku_human_write` MCP calls. This breaks the unit spec's V-06
mitigation #2 ("Both `upload-routes.ts` and `haiku_human_write` call
the shared helper").

**Control.** Add the missing `isIntentLocked` import + sibling guard
right next to the existing `isIntentArchived` block. Returns
`intent_locked` error consistently with the SPA's `423`. Locked-intent
rejection happens BEFORE any disk write, audit-log append, or
action-log stamp — same ordering as the archived-intent guard so the
MCP tool's failure mode is symmetric across both states.

---

## 2. Regression tests added

Each control above has at least one test that reproduces the pre-fix
attack and asserts the new behaviour blocks it. All tests exercise the
full call path (no mocks for the auth boundary or the tick-counter
helpers) so a future refactor can't silently regress the control.

| Control | Test file | Tests added |
|---|---|---|
| R-01 (cross-session JWT bypass) | `packages/haiku/test/upload-routes-strict-auth.test.mjs` (new file) | 6 tests: own-intent baseline (×2 routes), cross-session attack (×2 routes), unknown-session JWT, no-auth tunnel-gate fallthrough |
| R-02 (V-05 producer fix on MCP) | `packages/haiku/test/haiku-human-write.test.mjs` | 2 tests: intent-scope MCP write uses deterministic counter (NOT readdirSync lottery), stage-scope MCP write parses stage slug from canonical path |
| R-03 (locked intent rejection on MCP) | `packages/haiku/test/haiku-human-write.test.mjs` | 3 tests: canonical `status: locked` rejected with `intent_locked`, single-quoted `status: 'locked'` rejected (V-06 cross-surface contract), body-text quoting `status: locked` does NOT lock (no false-positives via shared helper) |

**Whole-suite gate:** `bun run --cwd packages/haiku test` →
**1198 passed, 0 failed** across **61 test files**. Pre-blue-team
baseline was 1187/1187 across 60 files — +11 new regression tests, +1
new test file, no regressions in existing suites.

---

## 3. Test naming for FM-gate stability

The unit's frontmatter gate `v03-author-mismatch-rejected-test-named`
greps `state-tools-handlers.test.mjs` for `claimed_author_id` —
unchanged by this work. The new R-01/R-02/R-03 tests live in
`upload-routes-strict-auth.test.mjs` and `haiku-human-write.test.mjs`
respectively, so they don't perturb that grep target.

---

## 4. Findings explicitly NOT addressed (red-team's own routing)

Per the red-team report's summary table column "Required for unit-02 to
be defensibly closed?":

| ID | Sev | Disposition |
|----|-----|-------------|
| R-04 | HIGH | DoS via 1 MB attribution per upload — red-team marked NO ("risk-accept with cap or carry to unit-04"). Carrying to unit-04 ASSESSMENTS residual risk (see §5). Adjacent to V-09 (unbounded `agent_rationale`). |
| R-05 | MED  | Cross-process tick-counter race — red-team marked NO ("document in residual risk if multi-MCP not in scope"). Pre-existing intent-design constraint already documented in `intent.md` (eventual-consistency concurrency model); §5 below carries it. |
| R-06 | MED  | `intent-tick.json` not on deny-list — red-team marked NO ("defense-in-depth, easy add"). Carrying to unit-04 ASSESSMENTS residual risk; not currently exploitable (allow-list excludes it implicitly). |
| R-07 | MED  | Crash-mid-write audit log durability — red-team marked NO ("pair with V-03 fix #3 deferral"). Already paired with the existing audit-log hash-chaining deferral. |
| R-08 | LOW  | `isIntentLocked`/`isIntentArchived` swallow parse errors silently — red-team marked NO ("observability, not control"). Carry to telemetry-improvement work, not a unit-02 blocker. |
| R-09 | LOW  | YAML key case-sensitivity (`Status:` vs `status:`) — red-team marked NO ("same edit window as R-08"). Pair with R-08 telemetry work. |

---

## 5. Residual risk carried forward to unit-04 ASSESSMENTS.md

Unit-04 MUST file follow-up FBs for the following items so the
intent's overall security posture is honest about what's deferred
versus what's closed:

- **R-04 — DoS via unbounded `attribute_to_user` field.** Add
  `fieldSize: 256` to `@fastify/multipart` `limits` block AND length /
  charset validation on `attribute_to_user`, `claimed_author_id`,
  `human_author_id` on both SPA + MCP surfaces. Severity: HIGH (the
  red-team flagged this as borderline-required; we carried it because
  no exploit-today proof and the unit spec didn't mention DoS-class
  controls — but it's exploitable today, so unit-04 should treat it as
  a near-term must-fix).
- **R-05 — Cross-process tick-counter race.** Add advisory file lock
  (`proper-lockfile`) or O_APPEND counter-log dance to
  `getIntentScopeTickCounter`. Pair with the V-03 fix #3 audit-log
  hash-chaining deferral; both improve audit-log integrity under
  concurrent / crash conditions.
- **R-06 — `intent-tick.json` deny-list gap.** Add to
  `haiku_human_write` `DENY_LIST`. Defense-in-depth; not exploitable
  today.
- **R-07 — Crash-mid-write audit-log durability.** Pair with the V-03
  fix #3 audit-log hash-chaining deferral — both relate to durable
  append semantics for `write-audit.jsonl` and `action-log.jsonl`.
- **R-08, R-09 — Helper telemetry + YAML-case normalisation.** Group
  with general observability improvements; low priority.

---

## 6. References

- `stages/security/artifacts/RED-TEAM-unit-02.md` — input to this
  artifact (R-01..R-09 enumeration + per-finding fix recommendations).
- `stages/security/artifacts/SECURITY-ASSESSMENT-unit-02.md` —
  implementer-hat record of the original V-03 / V-05 / V-06 controls
  that this artifact extends.
- `stages/security/artifacts/THREAT-MODEL-unit-02.md` — STRIDE input
  the implementer worked from.
- `stages/security/units/unit-02-author-identity-binding.md` — unit
  spec + frontmatter quality_gates (all 9 gates remain passing after
  blue-team work).
- `plugin/studios/software/stages/security/hats/blue-team.md` — hat
  description (defense-verification deliverable shape).
- Code: see §1 above for file:line references to every landed control.
- Tests: see §2 above for test file:name references to every
  regression test.
