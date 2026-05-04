---
title: >-
  CSRF Layer 2 origin allowlist defaults to localhost without startup warning
  when tunnel mode is on
status: addressed
origin: adversarial-review
author: security (from development)
author_type: agent
created_at: '2026-05-03T11:06:10Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-03T11:06:10Z'
resolution: inline_fix
replies: []
hat: security-engineer
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T12:19:13Z'
    result: advanced
---
**Severity:** Medium (configuration trap)

**Summary:** When `HAIKU_REMOTE_REVIEW=1` is set but `HAIKU_ALLOWED_ORIGINS` is not, `csrf.ts:readAllowedOrigins()` silently defaults to `["http://localhost:*"]`. In tunnel mode this is **misaligned**: the SPA is hosted on the tunnel's public origin, so every legitimate cross-origin POST is rejected as `origin_not_allowed` while no warning fires. There IS an analogous startup warning for the **CORS** allowlist (`HAIKU_REVIEW_ALLOWED_ORIGINS` in `http.ts:360-369`), but no warning for the **CSRF** allowlist (`HAIKU_ALLOWED_ORIGINS`).

**Where:**
- Default: `packages/haiku/src/http/csrf.ts:87-94` (`readAllowedOrigins`, default `["http://localhost:*"]`).
- Missing warning: `packages/haiku/src/http.ts:351-371` (`startHttpServer` warns on `HAIKU_REVIEW_ALLOWED_ORIGINS` only).

**Two failure modes:**

1. **Soft fail (operator-visible after-the-fact):** Tunnel-deployed reviewer hits POST endpoints; everything 403s; no log line at startup explains why. `csrf.ts` returns `reason: "origin_not_allowed"` on each request — the operator has to inspect per-request logs to figure out the configuration is missing. The `HAIKU_REVIEW_ALLOWED_ORIGINS` warning was added precisely to prevent this exact discovery latency for CORS; the same warning is needed for CSRF.

2. **Silent over-permission (more concerning):** Two env vars (`HAIKU_REVIEW_ALLOWED_ORIGINS` for CORS, `HAIKU_ALLOWED_ORIGINS` for CSRF Layer 2) sound similar enough that operators will set one and assume both are configured. If they set only `HAIKU_REVIEW_ALLOWED_ORIGINS`, the CSRF allowlist silently stays at `localhost:*` — wrong for tunnel mode but obscured. If they set only `HAIKU_ALLOWED_ORIGINS`, CORS issues 403s. Either way the misalignment is invisible at startup.

**Spirit of mandate:** Mandate calls out "no insecure defaults (permissive CORS, debug mode, disabled TLS verification)." A localhost-default Origin allowlist that silently mismatches the actually-deployed origin is the same class of insecure default — the failure is silent and the configuration is non-obvious.

---

## Diagnosis (security-engineer · bolt 1)

**Surface scope.** Tunnel-mode startup observability for the CSRF Layer 2 origin allowlist. Boundary: `startHttpServer()` in `packages/haiku/src/http.ts` runs once per MCP server boot. Trust boundary crossed: the operator's intent to expose a tunnel-hosted SPA vs. the application's silent fall-back to a localhost-only Origin allowlist. Data class: server configuration (env vars), not request data.

**Verified current state.**
- `packages/haiku/src/http/csrf.ts:87-94` — `readAllowedOrigins()` returns `["http://localhost:*"]` when `HAIKU_ALLOWED_ORIGINS` is empty/unset. Confirmed by reading the file in this worktree; the body matches the reviewer's citation exactly.
- `packages/haiku/src/http.ts:351-371` — `startHttpServer()` emits a `WARNING:` line when `isRemoteReviewEnabled()` is true and the **CORS** allowlist (`review.allowedOrigins`, sourced from `HAIKU_REVIEW_ALLOWED_ORIGINS` / `HAIKU_REVIEW_SITE_URL`) contains no non-`*` entries. There is **no** parallel block testing `process.env.HAIKU_ALLOWED_ORIGINS` for the CSRF layer.
- `packages/haiku/src/http.ts:35` already imports `isRemoteReviewEnabled` from `./tunnel.js`, so the gating predicate is in scope at the call site — no new import needed for the proposed fix.

**Desired state.** When `isRemoteReviewEnabled() === true` AND `process.env.HAIKU_ALLOWED_ORIGINS` is unset (or empty after trim), `startHttpServer()` MUST emit a `WARNING:` line on `console.error` before `buildApp()` runs, naming the env var (`HAIKU_ALLOWED_ORIGINS`), the layer it controls (CSRF Layer 2 origin allowlist), the failure symptom (every cross-origin POST/PUT/DELETE will be rejected as `origin_not_allowed`), and the remediation (set the env var to a comma-separated allowlist). This mirrors the existing CORS warning so an operator scanning startup logs sees both misconfigurations side-by-side.

**Gap (one sentence).** `startHttpServer()` warns on the CORS env var but not on the CSRF env var, even though the failure mode (silent localhost default in tunnel mode) is identical.

**Comparable working sibling.** `packages/haiku/src/http.ts:360-369` — the CORS warning block. Same gating predicate (`isRemoteReviewEnabled()`), same emptiness check pattern, same `console.error("WARNING: …")` shape. Differences to apply when porting to the CSRF case:
- Read source must be `process.env.HAIKU_ALLOWED_ORIGINS` (raw env var) rather than `review.allowedOrigins`, because the `csrf.ts` allowlist is computed inside `csrf.ts` with no exported accessor and no shared `review`-style config object — checking the env var directly mirrors how `csrf.ts:readAllowedOrigins()` itself decides whether to default.
- Failure-mode wording must reference the CSRF layer (Layer 2 origin allowlist), not CORS, and must name `HAIKU_ALLOWED_ORIGINS` so operators do not confuse it with the CORS env var.
- The check belongs in the same `if (isRemoteReviewEnabled())` block as the existing CORS warning so a single tunnel-mode boot emits both warnings (or neither) atomically.

## Threat coverage

| Threat (from FB-36 body) | Control | Status | Test |
|---|---|---|---|
| Soft-fail: tunnel reviewer hits 403s with no startup log explaining why | Add CSRF-allowlist startup warning analogous to the CORS warning at `http.ts:360-369`, gated on `isRemoteReviewEnabled() && !process.env.HAIKU_ALLOWED_ORIGINS?.trim()` | **TO BE ADDED** by next fix hat in chain (this is the diagnosis bolt; implementation lands when the implementer hat picks up the FB body) | New unit test in `packages/haiku/test/http.startup-warnings.test.ts` (or extend whatever covers the CORS warning) capturing `console.error` and asserting the CSRF warning line appears with `HAIKU_REMOTE_REVIEW=1` + `HAIKU_ALLOWED_ORIGINS` unset, and does NOT appear when the env var is set |
| Silent over-permission: operator sets one env var, assumes both are configured | Same warning surfaces the missing var by name (`HAIKU_ALLOWED_ORIGINS`) at boot — operator cannot ship a tunnel without seeing the warning if the var is unset | **TO BE ADDED** (same change) | Same test — exercising "CORS set, CSRF unset" boots and asserting the CSRF warning still fires (and vice versa) proves the two checks are independent |

## Implementation references (proposed)

- `packages/haiku/src/http.ts` — extend the existing `if (isRemoteReviewEnabled()) { … }` block in `startHttpServer()` (currently lines 360-370) to also test `process.env.HAIKU_ALLOWED_ORIGINS`. Suggested addition (illustrative, implementer to finalize wording):

  ```ts
  if (isRemoteReviewEnabled()) {
      const allowed = review.allowedOrigins.filter((o) => o && o !== "*")
      if (allowed.length === 0) {
          console.error(
              "WARNING: HAIKU_REMOTE_REVIEW=1 but no allowed origins configured. " +
                  "Every cross-origin request from the SPA will be rejected by CORS. " +
                  "Set `HAIKU_REVIEW_ALLOWED_ORIGINS` (comma-separated) or " +
                  "`HAIKU_REVIEW_SITE_URL` before starting.",
          )
      }
      // FB-36: CSRF Layer 2 has its own allowlist (HAIKU_ALLOWED_ORIGINS).
      // It silently defaults to ["http://localhost:*"] in csrf.ts:readAllowedOrigins,
      // which is wrong for tunnel mode and produces silent `origin_not_allowed`
      // 403s on every cross-origin POST. Mirror the CORS warning so operators
      // notice the misconfiguration at boot rather than per-request.
      const csrfAllowedRaw = process.env.HAIKU_ALLOWED_ORIGINS?.trim() ?? ""
      if (csrfAllowedRaw === "") {
          console.error(
              "WARNING: HAIKU_REMOTE_REVIEW=1 but HAIKU_ALLOWED_ORIGINS is unset. " +
                  "CSRF Layer 2 origin allowlist defaults to `http://localhost:*`, " +
                  "so every cross-origin POST/PUT/DELETE from the tunnel SPA will be " +
                  "rejected with `origin_not_allowed`. Set `HAIKU_ALLOWED_ORIGINS` " +
                  "(comma-separated) to your tunnel origin(s) before starting.",
          )
      }
  }
  ```

- `packages/haiku/src/http/csrf.ts:87-94` — `readAllowedOrigins()` is the source of the silent default; the implementer hat MAY additionally add a one-line comment cross-referencing the new warning in `http.ts` so future readers see both halves of the contract. No behavior change to `csrf.ts` itself — the warning lives in the startup path, not the per-request path, per the reviewer's "Suggested fix" item 1.

## Test references (proposed)

- New or extended test file: `packages/haiku/test/http.startup-warnings.test.ts` (location follows the existing test layout under `packages/haiku/test/`). Cases to cover:
  1. `HAIKU_REMOTE_REVIEW=1`, `HAIKU_ALLOWED_ORIGINS` unset → CSRF warning emitted (assert on captured `console.error` output containing `HAIKU_ALLOWED_ORIGINS` and `CSRF`).
  2. `HAIKU_REMOTE_REVIEW=1`, `HAIKU_ALLOWED_ORIGINS=https://example.tunnel.dev` → CSRF warning NOT emitted.
  3. `HAIKU_REMOTE_REVIEW` unset → CSRF warning NOT emitted regardless of `HAIKU_ALLOWED_ORIGINS`.
  4. `HAIKU_REMOTE_REVIEW=1`, `HAIKU_REVIEW_ALLOWED_ORIGINS` set, `HAIKU_ALLOWED_ORIGINS` unset → CORS warning suppressed BUT CSRF warning still fires (proves independence — the silent-over-permission failure mode the reviewer called out).

## Residual risk

After the proposed fix lands, the residual risk surface is:

1. **Operator ignores the warning.** A `console.error` line at boot is observability, not enforcement — an operator running under `nohup` or a CI job that swallows stderr may still ship a misconfigured tunnel. Acceptance: this is the same residual risk the existing CORS warning carries; both warnings are first-line operator-facing observability, not a security boundary. The reviewer's third "Suggested fix" item (fail-closed: refuse to start if neither var is set in tunnel mode) is the next-stronger control. **Decision deferred** to a follow-up FB; this bolt's scope is parity with the CORS warning, per the comparable-working-sibling discipline. Recording it here so the assessor sees the residual is acknowledged, not silently accepted.

2. **Env-var split persists.** The reviewer's second "Suggested fix" — collapse `HAIKU_REVIEW_ALLOWED_ORIGINS` and `HAIKU_ALLOWED_ORIGINS` into one var — is a breaking change to the operator surface and out of scope for a configuration-trap fix. The warning makes the split visible at boot; merging the vars is a separate refactor. **Decision deferred** to a follow-up FB.

3. **Race between warning and request handling.** `console.error` runs before `buildApp()` (line 372 in current `http.ts`), which means the warning is guaranteed to land in operator logs strictly before the server accepts any request. No race.

4. **Localhost-only deploys still see no warning.** When `isRemoteReviewEnabled()` is false (the default), the warning is suppressed because the localhost default is correct for that case. This is intentional and matches the existing CORS warning's gating — no residual exposure.

**Net residual after fix:** the only documented gap is the operator-ignoring-warning class (residual #1 above), which is identical to the residual the existing CORS warning carries and is acceptable as parity. The fail-closed control is logged as deferred work, not silently dropped.
