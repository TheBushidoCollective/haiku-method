# Unit 03 — Blue-Team Verification

**Hat:** blue-team (bolt 1)
**Stage:** security
**Date:** 2026-05-01
**Companion artifacts:** `THREAT-MODEL.md`, `IMPLEMENTATION.md`, `RED-TEAM-FINDINGS.md`

This artifact records what the blue-team did with the red-team's
findings. The blue-team's contract per `dev/plugin/studios/software/stages/security/hats/blue-team.md`:

> Defense verification — implement security controls for identified
> threats, add security tests that prove the controls work, and validate
> monitoring coverage for security events. **Fix root causes, not
> symptoms.**

## Summary

| Surface | Pre-blue-team posture | Action taken |
|---|---|---|
| V-04 — symlink TOCTOU | 7/7 red-team attacks HELD | Verified — no code change |
| V-08 — CSRF defence-in-depth | 7/7 red-team attacks HELD | Verified — no code change |
| V-10 — feedback sanitizer | 13/13 red-team attacks HELD (5 with documented residual) | Verified — residuals stay open per scope (deferred to unit-04 ASSESSMENTS.md) |
| V-11 — baseline-corrupt operator gate | 3/6 red-team attacks BYPASSED (RT1, RT2, RT6) | **Root-cause fix landed**: re-anchor "previously established" + thrash-counter signals on tamper-evident surfaces (action-log + content-addressed sidecars), with the legacy single-file-cache kept as a fast-path |

After the fix, **all 33 red-team attacks now HELD** (`unit-03-red-team.test.mjs` summary: `33 passed, 0 failed`). The 8 informational findings the red-team logged (V-10 sanitizer residuals + V-11 RT3/RT4/RT5) carry forward unchanged — they are scope-deferred per `THREAT-MODEL.md` and `IMPLEMENTATION.md` §5, not regressions.

## V-11 root-cause fix — what changed

The red-team's RT1, RT2, and RT6 bypasses all stemmed from the same root cause: the V-11 gate's two security-critical signals lived on tamper-mutable JSON files that an out-of-band attacker (the unit's threat model) could disarm by deletion or stealth-truncation:

- **`wasBaselinePreviouslyEstablished`** read `drift_baseline_established_at` from `state.json`. Delete or truncate that one field and the gate believed it was a fresh first-tick → silent-establish opens (RT1, RT6).
- **`isBaselineThrashing`** read events from `baseline-thrash.json`. Delete the file and the circuit-breaker zeros out (RT2).

The fix re-anchors both signals on append-only / content-addressed surfaces while keeping the original cache files as the fast read path:

### 1. `wasBaselinePreviouslyEstablished` — three sources, OR semantics

`packages/haiku/src/orchestrator/workflow/drift-baseline.ts` now consults THREE sources in priority order; ANY of them returning true is enough:

1. **Action-log marker** — every successful establish appends a `baseline_established` entry to `action-log.jsonl` (append-only, tamper-evident). New `entry_type` value added to the `ActionLogEntry` union in `write-audit.ts`. Sentinel `path` (`__baseline_marker__:established:{stage}`) so the marker never collides with a real tracked file and existing `entry_type === "human_write" | "agent_write"` filters keep their semantics.
2. **Validated baseline-content sidecar presence** — the `baseline-content/` directory holds sha256-named, content-addressed snapshots of every baselined file. The check walks the directory and returns true if ANY entry's content matches its filename (sha256). Removing all sidecars to disarm the gate would also wipe `reconstructPriorBaseline`'s inputs — the operator-confirmation diff would surface a totally-empty reconstructed baseline, making the attack loud rather than silent.
3. **state.json fast path** — legacy behavior, kept for back-compat with stages established before the action-log marker existed.

Returns false only when ALL three sources are absent — the legitimate first-tick case.

### 2. `recordBaselineCorruption` / `isBaselineThrashing` — action-log floor

`recordBaselineCorruption` now appends a `baseline_corruption_event` entry to `action-log.jsonl` IN ADDITION to writing the `baseline-thrash.json` cache. `isBaselineThrashing` takes `MAX(cache_count, log_count)` so an attacker who deletes only the cache file is still seen as thrashing if the log retains the events. Both surfaces would have to be silently rewritten for the bypass to land.

### 3. Wire-up at the establish path

`packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` now calls `recordBaselineEstablishedMarker(intentDir, activeStage, tickCounter)` immediately after `stampBaselineEstablished` in the establish branch. Best-effort — failure to log doesn't fail the establish, but the next `baseline_corrupt` detection falls back to the (weaker) state.json fast-path.

## Files modified

| File | Change |
|---|---|
| `packages/haiku/src/orchestrator/workflow/write-audit.ts` | Widened `ActionLogEntry.entry_type` union to include `baseline_established` and `baseline_corruption_event`. |
| `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` | Added `appendActionLogEntrySync` (sync, gate-friendly), `actionLogHasBaselineEstablished`, `actionLogCountCorruptionEvents`, `hasValidatedBaselineSidecar`, `recordBaselineEstablishedMarker`, `recordBaselineCorruptionMarker`. Rewrote `wasBaselinePreviouslyEstablished` to consult action-log → sidecar → state.json (fast-path). Updated `recordBaselineCorruption` to mirror events to the action-log; updated `isBaselineThrashing` to take MAX(cache, log). |
| `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` | Imported `recordBaselineEstablishedMarker`; called it on every successful establish. |
| `packages/haiku/test/unit-03-red-team.test.mjs` | Updated V-11.RT1, RT2, RT6 to assert the FIXED behavior (defence holds). Comments explain the closure and reference the fix location. |
| `packages/haiku/test/unit-03-security.test.mjs` | Added five new V-11.B1..B5 blue-team regression tests pinning the new contract from a clean fixture. |

## Test outcomes

| Suite | Pre-blue-team | Post-blue-team |
|---|---|---|
| `unit-03-security.test.mjs` | 46/46 pass | **51/51 pass** (+5 new V-11.B1..B5 blue-team tests) |
| `unit-03-red-team.test.mjs` | 30 HELD, 3 FAIL (RT1, RT2, RT6 bypassed) | **33/33 HELD, 0 FAIL** |
| `drift-baseline.test.mjs` | 23/23 pass | 23/23 pass |
| `drift-detection-gate.test.mjs` | 29/29 pass | 29/29 pass |
| `bun run --cwd packages/haiku test` (full fleet) | 1213 pass / 0 fail across 61 files | **1251 pass / 0 fail across 62 files** |

The full fleet's net change is `+38` passing tests (5 new blue-team + 33 red-team that previously logged findings but now all HELD with explicit assertions; net grew by less than 38 because some findings-only branches turned into asserted HELD branches).

## Anti-pattern audit (blue-team contract — `dev/plugin/studios/software/stages/security/hats/blue-team.md`)

- **MUST NOT patch the specific payload used in testing instead of the vulnerability class.** The fix targets the vulnerability class — "security signal lives on tamper-mutable single-file cache" — not just RT1's specific `unlinkSync(state.json)` payload. RT2's `unlinkSync(baseline-thrash.json)` and RT6's stealth-field-removal are the SAME vuln class and are closed by the SAME fix.
- **MUST add regression tests that reproduce the original attack.** RT1, RT2, RT6 in `unit-03-red-team.test.mjs` execute the EXACT attack fixtures (delete state.json, delete baseline-thrash.json, stealth-truncate the field) and assert the defence holds. New `V-11.B1..B5` blue-team tests pin the contract directly at the helper boundary.
- **MUST NOT implement security controls without testing them.** Five new V-11.B blue-team tests (action-log-only, sidecar-only, sidecar-with-mismatched-hash, action-log-floor-after-cache-delete, all-three-absent-first-tick) cover every branch of the fix.
- **MUST NOT choose functionality over security without explicit human approval.** No functional regressions: every prior test passes, the fix is additive (legacy state.json fast path retained for back-compat).
- **MUST NOT treat WAF rules as sufficient without fixing the underlying code.** The fix is application-layer in the gate path, not an external rule. The action-log mirror happens in the same process as the gate decision.

## Carried-forward residuals (NOT addressed by this bolt — see `IMPLEMENTATION.md` §5 and `RED-TEAM-FINDINGS.md`)

These remain open per `THREAT-MODEL.md` scope and the unit-03 spec's "out of scope" section. The unit-04 author hat MUST file `stage_revisit` FBs at intent-completion review for the items it wants to escalate.

- **V-04 residual** — `O_NOFOLLOW`/`openat` race window (microsecond-scale) still exists; closing it requires a native addon. Documented in `IMPLEMENTATION.md` §5 item 1.
- **V-08 residual** — Layer 3 (per-session CSRF nonce) is opt-in via `HAIKU_CSRF_NONCE_REQUIRED=true`. SPA bootstrap update is folded into a follow-up unit. Layers 1+2 are sufficient against the cross-origin attack class.
- **V-10 residuals (5)** — sanitizer scope is markdown/HTML, not CSS or `<meta>` tags or modern URL-scheme obfuscations (tab/newline-embedded scheme, markdown angle-bracket autolinks). The SPA renderer's input-side allowlist is the primary defence; the server sanitizer is defence-in-depth.
- **V-11.RT3 residual** — `.baseline-ack` marker storage layer is permissive (validates only `diff_hash` shape). The drift gate's single-use semantics (`clearBaselineAckMarker`) limit blast radius to one silent-establish per OOB write. Threat-model assumption: an attacker with OOB filesystem access has won bigger fights.
- **V-11.RT4 residual** — thrash threshold is `> 3`; a paced attacker can fire ≤ 3 corruption events per 10-tick window indefinitely. Each requires an operator ack to recover, so the attack is loud (operator-visible).
- **V-11.RT5 residual** — `reconstructPriorBaseline` doesn't filter action-log paths through `canonicalisePath` + tracked-surface allowlist. A forged log entry could surface `../../etc/passwd` in the operator-visible diff. Operator review is the defence; recommended hardening is to filter paths in the reconstruction function (deferred to unit-04 / unit-05).
- **Operator-confirmation UX for V-11 baseline reset** — the marker-write side is in place; `/haiku:repair --confirm-baseline-reset --diff-shown --confirm-diff-hash <sha>` plumbing into the `haiku_repair` MCP tool's CLI flag surface is deferred (per `IMPLEMENTATION.md` §5 item 5).

## Verdict

V-04, V-08, V-10, and V-11 mitigations are sound against the bypass attempts in `unit-03-red-team.test.mjs`. The three V-11 bypasses (RT1, RT2, RT6) the red-team confirmed are now CLOSED at the helper boundary; pinned by five new V-11.B blue-team regression tests; verified against the existing 1251-test fleet with zero regressions. Residuals are documented and folded into the unit-04 ASSESSMENTS.md residual-risk section.
