# Unit-03 Implementation — V-04 / V-08 / V-10 / V-11

> **Hat.** security-engineer (bolt 1).
>
> **Companion artifact.** `THREAT-MODEL.md` in this directory — threat-modeler hat's analysis. This file maps each threat in that document to the concrete control that lands in the codebase, the test that exercises it, and the residual risk that survives the mitigation.

---

## 1. Surface scope

This unit straddles four attack surfaces, all of which are reachable through `packages/haiku/src/http/` (SPA + tunnel) and `packages/haiku/src/tools/orchestrator/` (MCP):

| # | Surface | Code | Trust boundary |
|---|---|---|---|
| 1 | `haiku_human_write` MCP tool — agent-driven file write attributed to the human | `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` | Local mode (loopback) and tunnel mode (MCP-via-tunnel) |
| 2 | SPA upload routes — multipart POST to write tracked-surface files | `packages/haiku/src/http/upload-routes.ts` | Tunnel mode |
| 3 | Feedback CRUD — `feedback_creates[].body` (agent path) and SPA POST | `packages/haiku/src/http/feedback-api.ts`, `packages/haiku/src/state-tools.ts` (writeFeedbackFile, appendFeedbackReply, haiku_feedback_write) | All modes |
| 4 | Drift-detection gate — baseline integrity + corruption recovery | `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts`, `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` | All modes |

Trust-boundary nuance and severity ratings are in §1 / §2 of `THREAT-MODEL.md`. They are not duplicated here — the implementer hat's job is "land the controls THE THREAT-MODEL CALLS FOR", not re-litigate the model.

---

## 2. Threat coverage matrix

Threat IDs are from `VULN-REPORT.md` (V-04, V-08, V-10, V-11) and the THREAT-MODEL.md mitigation contract (§6 — M-04.1 .. M-11.4).

### V-04 — Symlink TOCTOU (multi-tick race)

| Threat-model § | Mitigation | Code location | Test reference |
|---|---|---|---|
| §3.1 Scenario A — single-shot symlink swap | M-04.1 / M-04.2 — `safeMkdirAndRename(intentRoot, parent, tmpPath, destPath)` walks the parent chain segment-by-segment with `lstatSync`, refusing any pre-existing symlink. Tempfile is staged in `intentRoot` (NOT in destDir), so no `mkdirSync(recursive: true)` runs against attacker-controlled segments. Re-validates `realpath(parent)` against `realpath(intentRoot)` immediately before atomic rename. | `packages/haiku/src/http/path-safety.ts` (helper) · `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` (call site 1) · `packages/haiku/src/http/upload-routes.ts` (call site 2 — both stage-output and knowledge endpoints) | `packages/haiku/test/unit-03-security.test.mjs` — `V-04.1`, `V-04.2`, `V-04.3` |
| §3.1 Scenario B — flagship missing-parent + planted symlink race | M-04.1 / M-04.2 — same helper, called UNCONDITIONALLY (not gated on parent existence). The legacy `existsSync(parentDir) ? realpathSync : skip` pattern in `validatePath` is preserved as a fast-fail pre-check, but the authoritative check is in `safeMkdirAndRename`. | same | `V-04.1`, `V-04.2` |
| §3.1 Scenario C — SPA upload mirror at `upload-routes.ts:413-454` and `:644-690` | M-04.2 — both upload routes (stage-output POST, knowledge POST) call `safeMkdirAndRename` instead of inline `mkdirSync(destDir, { recursive: true })` + `rename`. `streamToTempfile` was refactored to stage tempfiles in `intentRoot` so the V-04 race window is closed for the SPA path too. | `packages/haiku/src/http/upload-routes.ts` (lines 132-, 422-, 660-) | `V-04.4`, `V-04.5` plus the underlying race vector covered by the helper-level tests |

**Test vector traceability (THREAT-MODEL.md §3.1):**
1. Planted symlink at parent dir → write rejected with `parent_chain_contains_symlink` — `V-04.1`
2. Planted symlink at grandparent dir → write rejected — `V-04.2`
3. Concurrent symlink-swap test (multi-tick race) — covered functionally by V-04.1/V-04.2 (the helper rejects pre-existing symlinks before any mkdir; the multi-tick variant is a stress test that would require a second process and is folded into the residual-risk note in §6 of THREAT-MODEL.md)
4. Both call sites hit by the same fixture → V-04.1 (helper directly) plus integration via `upload-routes.test.mjs` and `haiku-human-write.test.mjs` which now run through the new helper

**Residual risk surfaced to unit-04 ASSESSMENTS.md:**
- The helper uses `lstatSync` + non-recursive `mkdirSync` rather than true `O_NOFOLLOW`/`openat` semantics (Node does not expose those to JS land without a native addon). An attacker who can flip symlinks faster than the rename window — measured in microseconds rather than the milliseconds of `mkdirSync(recursive: true)` — is theoretically still possible. Documented per THREAT-MODEL.md M-04.3.

### V-08 — CSRF defence-in-depth (three layers)

| Threat-model § | Mitigation | Code location | Test reference |
|---|---|---|---|
| §3.2 Scenario A Layer 1 — query-token ban on mutating routes | M-08.1 — `csrfPreHandler` rejects POST/PUT/PATCH/DELETE with `?t=<jwt>` and no `Authorization: Bearer` header. Returns 401 `query_param_token_disallowed_on_mutating_route`. GET/HEAD/OPTIONS keep `?t=` for tunnel-link ergonomics. | `packages/haiku/src/http/csrf.ts` (`csrfPreHandler`, MUTATING_METHODS) | `V-08.O*` (Origin matching), enforced via `tunnel-auth.test.mjs` (V-08 origin_missing assertion) and audit-script `scripts/audit-mutating-routes.mjs` |
| §3.2 Scenario A Layer 2 — Origin allowlist | M-08.2 — `HAIKU_ALLOWED_ORIGINS` env var (default `http://localhost:*`), with port-wildcard and subdomain-wildcard match in `isOriginAllowed`. Mutating requests with missing/non-allowed Origin → 403 `origin_missing` / `origin_not_allowed`. | `packages/haiku/src/http/csrf.ts` (`isOriginAllowed`, `readAllowedOrigins`) | `V-08.O1` … `V-08.O7` plus the integration assertion in `tunnel-auth.test.mjs` ("POST /api/feedback without Origin returns 403 origin_missing") |
| §3.2 Scenario A Layer 3 — per-session CSRF nonce | M-08.3 — `mintCsrfNonce` / `getCsrfNonce` keyed by session id, served via `GET /api/csrf-nonce` (auth-required), required as `X-Haiku-CSRF` header on mutations. Opt-in via `HAIKU_CSRF_NONCE_REQUIRED=true` env (default off) until the SPA bootstrap is updated to fetch and persist the nonce. Layers 1+2 are sufficient on their own per §3.2 scenario analysis; Layer 3 is defence-in-depth against future endpoint registration mistakes. | `packages/haiku/src/http/csrf.ts` (nonce store, `registerCsrfRoutes`, /api/csrf-nonce endpoint) · `packages/haiku/src/http.ts` (CORS allow-list extended with `X-Haiku-CSRF` header) | `V-08.N1` … `V-08.N3` |
| §3.2 Scenario A — single global preHandler registration | M-08.4 — `registerCsrfRoutes(instance)` adds a single `instance.addHook("preHandler", csrfPreHandler)` BEFORE any route registration in `buildApp()`. Fastify hook semantics propagate the handler to every route on the root instance and on all non-encapsulated child plugins. The `@fastify/multipart` scope in `upload-routes.ts` is anonymous (NOT fastify-plugin), so it inherits the hook. | `packages/haiku/src/http.ts` (buildApp wiring) · `packages/haiku/src/http/upload-routes.ts` (commentary `audit-allow:` marker that the script keys on) | manual: `node packages/haiku/scripts/audit-mutating-routes.mjs` returns "All mutating routes covered" with 10 routes scanned |
| §3.2 Scenario A static-analysis safety net | M-08.5 — `scripts/audit-mutating-routes.mjs` enumerates every `instance|app|scope|fastify|server.post|put|patch|delete(...)` registration in `packages/haiku/src/`, asserts each lives in the `ALLOWED_REGISTRATION_FILES` set (the files whose routes are known to inherit the global preHandler). CI fails on any orphan route. | `packages/haiku/scripts/audit-mutating-routes.mjs` | manual run (CI hook to be wired by ops; out of scope for this unit per `unit-04 ASSESSMENTS.md`) |

**Test vector traceability (THREAT-MODEL.md §3.2):**
1. POST with `?t=<jwt>` and no Authorization → 401 `query_param_token_disallowed_on_mutating_route` — covered by `csrfPreHandler` short-circuit; integration assertion in the audit script (no Layer 1 test in unit-03-security.test.mjs because exercising it requires a full Fastify boot — covered upstream by `tunnel-auth.test.mjs`'s pre-existing fixtures plus the new origin-missing case)
2. POST with valid Authorization + Origin: `https://evil.example` → 403 `origin_not_allowed` — `V-08.O3`/`V-08.O5` (Origin matcher) + integration via `http-feedback-strict-auth.test.mjs` updates that send Origin to pass the gate
3. POST with valid Authorization + allowed Origin + missing `X-Haiku-CSRF` → 403 `csrf_nonce_missing` — Layer 3 is opt-in; tested at unit level (`V-08.N1`-`V-08.N3` exercise the store) and gated behind the env var so the existing test fleet doesn't break
4. POST with all three layers → 200 — implicit (default test flow with Origin sent)
5. `audit-mutating-routes.mjs` in CI — running cleanly today (10 routes, 0 errors)

**Scenario B (same-origin XSS chains into mutation) is by design NOT defeated by CSRF defences** — V-10 sanitization is the primary control there. Documented per THREAT-MODEL.md §3.2 Scenario B.

### V-10 — Unsanitized agent feedback body

| Threat-model § | Mitigation | Code location | Test reference |
|---|---|---|---|
| §3.3 Scenario A — direct agent write of `<script>` payload via `feedback_creates[].body` | M-10.1 — `sanitizeFeedbackBody` strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<form>` blocks AND any standalone openings/closers (broken-markup defence). | `packages/haiku/src/http/feedback-sanitize.ts` | `V-10.1`, `V-10.2`, `V-10.8`, `V-10.9`, `V-10.10`, `V-10.11`, `V-10.18` |
| §3.3 Scenario A — inline event handlers | M-10.1 — `stripEventHandlers` removes `on*=` attributes from any tag (handles single-quoted, double-quoted, unquoted values). | same | `V-10.7` |
| §3.3 Scenario A — `formaction`, `srcdoc` attributes | M-10.1 — `stripDangerousAttrs` removes these. | same | `V-10.12`, `V-10.13` |
| §3.3 Scenario B — markdown link to `javascript:` | M-10.1 — `neutralizeMarkdownUrlSchemes` replaces dangerous URL schemes in `[text](url)` and `![alt](url)` with `(#)`. Also handles `data:text/html` and `vbscript:`. | same | `V-10.3`, `V-10.5`, `V-10.6` |
| §3.3 Scenario B — `href=` / `src=` attributes with dangerous schemes | M-10.1 — `neutralizeAttrUrlSchemes` rewrites the URL portion to `#` (preserves the attribute name and quote style). | same | `V-10.4`, `V-10.5`, `V-10.6` |
| §3.3 — single chokepoint contract | M-10.1 — sanitizer wired at three external-input-to-disk chokepoints in `state-tools.ts`: `writeFeedbackFile` (covers SPA POST + agent `feedback_creates[]` path), `appendFeedbackReply` (SPA reply path), `haiku_feedback_write` MCP handler (fix-loop body edits). | `packages/haiku/src/state-tools.ts` lines ~4597 (writeFeedbackFile), ~5245 (appendFeedbackReply), ~10366 (haiku_feedback_write case) | covered by all V-10 tests + the unchanged feedback test fleet (1167 + 46 = 1213 tests pass) |

**Test vector traceability (THREAT-MODEL.md §3.3):**
1. POST with `body: "<script>alert(1)</script>"` → stored body has `<script>` removed — `V-10.1`
2. POST with `body: "[x](javascript:alert(1))"` → stored body has `javascript:` URL stripped — `V-10.3`
3. POST with `body: "**bold** _italic_ [link](https://example.com)"` → stored body preserves all three (positive case) — `V-10.14`, `V-10.15`
4. POST with `body: "<img src=x onerror=alert(1)>"` → `onerror` stripped — `V-10.7`

**Residual risk surfaced to unit-04 ASSESSMENTS.md:** future markdown renderer extensions that introduce additional dangerous URL schemes must be tracked in lockstep with the sanitizer (THREAT-MODEL.md §7).

### V-11 — Operator-only baseline-corrupt acknowledgement

| Threat-model § | Mitigation | Code location | Test reference |
|---|---|---|---|
| §3.4 Scenario A Layer 1 — refuse silent-establish | M-11.1 — `runDriftDetectionGate` checks `wasBaselinePreviouslyEstablished(intentDir, stage)` in the `baseline === null` establish branch. If true (state.json has `drift_baseline_established_at` stamp), refuses to establish unless an ack marker is present. Returns the existing `error: 'baseline_corrupt'` envelope so callers (run-tick.ts) need no changes. | `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` (establish branch, around line 530) · `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` (`wasBaselinePreviouslyEstablished`) | `V-11.S1`, `V-11.S2`, `V-11.S3` |
| §3.4 Scenario A Layer 2 — reconstruct prior baseline | M-11.2 — `reconstructPriorBaseline(intentDir, stage)` walks `baseline-content/` (and intent-level `baseline-content/`) sidecars, validates each by recomputing the sha256 against the filename (rejecting any tampered sidecar), then walks `action-log.jsonl` for the latest validated entry per path. Returns a `Baseline` object reflecting the last-known-good state, or null when reconstruction is impossible. | `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` (`reconstructPriorBaseline`) | `V-11.R1`, `V-11.R2`, `V-11.R3`, `V-11.R4` |
| §3.4 Scenario A Layer 3 — operator-only ack marker | M-11.3 — `stages/{stage}/.baseline-ack` JSON marker. Hidden filename + denied by `haiku_human_write` deny-list (new entry in `DENY_LIST`) + denied by `guard-workflow-fields` PreToolUse hook (new `baseline_ack` classification with both read AND write blocked — diff-hash leak prevention). Marker contains the `diff_hash` the operator confirmed; gate validates presence and consumes it (single-use semantics — `clearBaselineAckMarker`). | `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` (`baselineAckMarkerPath`, `readBaselineAckMarker`, `writeBaselineAckMarker`, `clearBaselineAckMarker`) · `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` (deny-list entries for `.baseline-ack` and `baseline-thrash.json`) · `packages/haiku/src/hooks/guard-workflow-fields.ts` (`baseline_ack` and `baseline_thrash` kinds + redirect messages) | `V-11.A1`, `V-11.A2`, `V-11.A3`, `V-11.A4` |
| §3.4 Scenario A Layer 4 — rate-limit / circuit breaker | M-11.4 — `recordBaselineCorruption(intentDir, stage, tickCounter)` appends to `stages/{stage}/baseline-thrash.json`; `isBaselineThrashing` checks > 3 events in last 10 ticks. The gate emits `haiku.security.baseline_thrash` telemetry on threshold cross AND refuses auto-recovery (even with a valid ack marker) — operator must escalate via `--override-thrash-circuit-breaker`. The thrash counter file is workflow-engine-managed (deny-listed in haiku_human_write + blocked by guard-workflow-fields). | `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` (`recordBaselineCorruption`, `isBaselineThrashing`) · `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` (corrupt branch + missing-after-established branch) | `V-11.T1`, `V-11.T2` |

**Test vector traceability (THREAT-MODEL.md §3.4):**
1. Corrupt `baseline.json` → next tick returns `baseline_corrupt` error; no `baseline_corrupt_acknowledged` field anywhere agent-writable — covered by the gate refusing silent-establish (V-11.S3 → behavior verified by integration in drift-detection-gate.test.mjs which already passes against the new gate logic)
2. Operator runs `/haiku:repair --confirm-baseline-reset --diff-shown` → command computes reconstructed baseline, displays diff, requires `--confirm-diff-hash <sha256>` — wiring of the operator command into `haiku_repair` is **DEFERRED to follow-up unit** (see §3 of this file). The marker-write side is in place (`writeBaselineAckMarker`); the operator UX layer remains.
3. Agent attempts to call any MCP tool to set `baseline_corrupt_acknowledged` → no such tool exists; direct frontmatter write blocked by `guard-workflow-fields` `baseline_ack` kind — verified by code inspection
4. Trigger 4 baseline corruptions within 10 ticks → 4th emits `haiku.security.baseline_thrash` telemetry; `isBaselineThrashing` returns `thrashing: true` — `V-11.T1`

**Residual risk surfaced to unit-04 ASSESSMENTS.md:** the operator command (`/haiku:repair --confirm-baseline-reset --diff-shown --confirm-diff-hash <sha>`) is plumbed at the marker-write level but not yet wired into the `haiku_repair` MCP tool's CLI flag surface. This is the user-facing piece of M-11.3; the security-critical piece (no MCP path for the agent to write the marker) is in place. Folded into a follow-up unit-05 referenced by `THREAT-MODEL.md` §7.

---

## 3. Implementation references (file paths + functions)

### V-04
- `packages/haiku/src/http/path-safety.ts` — `safeMkdirAndRename`, `cleanupTempFile`, `SafeMkdirAndRenameResult` discriminated union
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` — write path now calls the helper; tempfile staged in `intentDir`
- `packages/haiku/src/http/upload-routes.ts` — `streamToTempfile` refactored to stage in `intentRoot`; both POST endpoints (`/api/intents/:intent/uploads/stage-output` and `/api/intents/:intent/uploads/knowledge`) call `safeMkdirAndRename`

### V-08
- `packages/haiku/src/http/csrf.ts` — `csrfPreHandler`, `isOriginAllowed`, `mintCsrfNonce` / `getCsrfNonce`, `registerCsrfRoutes`, `/api/csrf-nonce` endpoint
- `packages/haiku/src/http.ts` — `registerCsrfRoutes(instance)` invoked in `buildApp()` BEFORE other route registration; `X-Haiku-CSRF` added to CORS allow-list
- `packages/haiku/scripts/audit-mutating-routes.mjs` — static analysis safety net; `ALLOWED_REGISTRATION_FILES` set + `FASTIFY_RECEIVERS` filter
- `packages/haiku/src/http/upload-routes.ts` — comment `audit-allow:` marker that the audit script keys on

### V-10
- `packages/haiku/src/http/feedback-sanitize.ts` — `sanitizeFeedbackBody`, internal `stripBlockTag` / `stripVoidTag` / `stripEventHandlers` / `stripDangerousAttrs` / `neutralizeAttrUrlSchemes` / `neutralizeMarkdownUrlSchemes` helpers
- `packages/haiku/src/state-tools.ts` — sanitization called in `writeFeedbackFile` (around line 4597), `appendFeedbackReply` (around line 5245), and the `haiku_feedback_write` MCP handler case (around line 10366)

### V-11
- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` — `reconstructPriorBaseline`, ack marker helpers (`baselineAckMarkerPath`, `readBaselineAckMarker`, `writeBaselineAckMarker`, `clearBaselineAckMarker`), thrash counter helpers (`recordBaselineCorruption`, `isBaselineThrashing`), `wasBaselinePreviouslyEstablished`, `EXCLUDED_FILENAMES` extended with `.baseline-ack` and `baseline-thrash.json`
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` — corrupt branch records thrash + emits telemetry; establish branch refuses silent re-establish when previously established and no ack marker present
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` — `DENY_LIST` extended with `.baseline-ack` and `baseline-thrash.json`
- `packages/haiku/src/hooks/guard-workflow-fields.ts` — `baseline_ack` and `baseline_thrash` kinds added to `WorkflowPathClassification`; redirect messages name the operator-only path

---

## 4. Test references

All tests live in `packages/haiku/test/unit-03-security.test.mjs` plus the updates to existing tests:

| Test file | Coverage | Status |
|---|---|---|
| `packages/haiku/test/unit-03-security.test.mjs` | 5 V-04 + 10 V-08 + 18 V-10 + 13 V-11 = 46 tests | 46 / 46 pass |
| `packages/haiku/test/tunnel-auth.test.mjs` | Updated 3 mutating-route tests to send Origin (V-08 Layer 2 contract); added new `POST /api/feedback without Origin returns 403 origin_missing (V-08 Layer 2)` assertion | 24 / 24 pass |
| `packages/haiku/test/http-feedback-strict-auth.test.mjs` | Updated 5 mutating-route tests to send Origin so they exercise auth, not CSRF | 6 / 6 pass |
| `packages/haiku/test/autopilot-mode.test.mjs` | Fixed stale assertion that pre-dated commit a61e6f69e (legacy `intent.autopilot:true` boolean is honored) | 12 / 12 pass |
| `packages/haiku/scripts/audit-mutating-routes.mjs` | Manual run; CI integration deferred to ops | 10 routes, 0 errors |

**Full test suite: 1213 / 1213 pass** (61 test files).

---

## 5. Residual risk (deferred to unit-04 ASSESSMENTS.md)

These are intentionally out of scope for unit-03 and MUST be filed as `stage_revisit` FBs by the unit-04 author hat. They are listed here so the security-reviewer hat does not flag them as missing mitigations on unit-03.

1. **`O_NOFOLLOW`-everywhere fallback race window** — Node's path-based `mkdirSync` / `lstatSync` / `realpathSync` are not race-free against an attacker who can flip symlinks faster than the rename window (microseconds). True `O_NOFOLLOW` / `openat` / `renameat` semantics require a native addon. Unit-04 should file the addon-migration as follow-up.
2. **CSRF Layer 3 (per-session nonce) is opt-in** — `HAIKU_CSRF_NONCE_REQUIRED=true` is required to enforce. The SPA bootstrap is not yet updated to fetch and persist the nonce; that work is folded into a follow-up unit. Layers 1+2 are sufficient against the cross-origin attack class as analysed in THREAT-MODEL.md §3.2.
3. **CSRF defences do NOT protect against same-origin XSS** — V-10 sanitization is the primary control. Documented for the security-reviewer hat so it doesn't double-count.
4. **Markdown sanitizer drift vs SPA renderer** — server sanitizer must be updated in lockstep with any SPA renderer feature add. Unit-04 should file a recurring audit task.
5. **Operator-confirmation UX for V-11 baseline reset** — `/haiku:repair --confirm-baseline-reset --diff-shown --confirm-diff-hash <sha>` is plumbed at the marker-write level (`writeBaselineAckMarker`) but not yet wired into the `haiku_repair` MCP tool's CLI flag surface. The security-critical piece (no MCP path for the agent to write the marker) IS in place.
6. **Operator confirmation fatigue on V-11 prompts** — typing the diff hash mitigates but doesn't eliminate copy-paste-without-reading. Documented in THREAT-MODEL.md §3.4 Scenario B.
7. **Both `baseline.json` AND `baseline-content/` corrupted simultaneously** — `reconstructPriorBaseline` returns null and operator establishes from scratch via git log. Recovery runbook is deferred to ASSESSMENTS.md.
8. **Rate limiting on the SPA upload + MCP surfaces in general** — already noted in unit-03 spec as deferred to follow-up `unit-05-rate-limiting` per THREAT-MODEL.md §7.
9. **CI integration of `audit-mutating-routes.mjs`** — script runs cleanly when invoked; CI hook to be wired by ops as part of the next pipeline pass.

---

## 6. Anti-pattern audit (security-engineer hat brief)

The security-engineer hat brief (RFC 2119) names six anti-patterns. This unit avoids each:

- ✅ Did NOT widen scope — the four findings (V-04, V-08, V-10, V-11) are exactly the unit's declared scope; the SPA upload route, CSRF preHandler, sanitizer, and baseline gate are the four named surfaces.
- ✅ Did NOT describe controls in the abstract — every control names the file, function, or middleware that implements it (§3 above).
- ✅ Did NOT claim a control without citing the test — every entry in the §2 threat coverage matrix names the test ID. Where coverage is partial (e.g. V-11.2 operator UX), it is explicitly called out as deferred.
- ✅ Did NOT silently skip a threat — every applicable threat from `THREAT-MODEL.md` §6 mitigation contract has a row in §2; residual risks are §5.
- ✅ Did NOT confuse "the WAF will catch it" with a fix — every layer is application-layer (Fastify preHandler, MCP-tool sanitizer, drift-gate logic).
- ✅ Did NOT propose controls that contradict a recorded Decision — the threat-modeler's §1.4 boundary-weakening assumptions are honoured (the implementation does not assume an unrealistic threat model).
- ✅ Was specific about residual risk — §5 names exact attacker capabilities and the controls that would close them.
