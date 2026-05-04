---
title: >-
  Symlink TOCTOU + layered CSRF + feedback sanitization + baseline-corrupt
  operator gate (V-04, V-08, V-10, V-11)
depends_on: []
inputs:
  - .haiku/intents/out-of-band-human-file-modifications/knowledge/VULN-REPORT.md
  - packages/haiku/src/state-tools.ts
  - packages/haiku/src/http/upload-routes.ts
  - packages/haiku/src/http/default-routes.ts
  - packages/haiku/src/http/feedback-api.ts
  - packages/haiku/src/http/auth.ts
  - packages/haiku/src/http/path-safety.ts
  - packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
outputs:
  - stages/security/artifacts/unit-03/THREAT-MODEL.md
  - stages/security/artifacts/unit-03/IMPLEMENTATION.md
  - packages/haiku/scripts/audit-mutating-routes.mjs
  - packages/haiku/src/hooks/guard-workflow-fields.ts
  - packages/haiku/src/http.ts
  - packages/haiku/src/http/csrf.ts
  - packages/haiku/src/http/feedback-sanitize.ts
  - packages/haiku/src/http/path-safety.ts
  - packages/haiku/src/http/upload-routes.ts
  - packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
  - packages/haiku/src/state-tools.ts
  - packages/haiku/src/tools/orchestrator/haiku_human_write.ts
  - packages/haiku/test/autopilot-mode.test.mjs
  - packages/haiku/test/http-feedback-strict-auth.test.mjs
  - packages/haiku/test/tunnel-auth.test.mjs
  - packages/haiku/test/unit-03-security.test.mjs
  - stages/security/artifacts/unit-03/RED-TEAM-FINDINGS.md
  - packages/haiku/test/unit-03-red-team.test.mjs
  - stages/security/artifacts/unit-03/BLUE-TEAM-VERIFICATION.md
  - packages/haiku/src/orchestrator/workflow/write-audit.ts
model: sonnet
quality_gates:
  - name: v04-shared-safe-mkdir-helper
    command: >-
      grep -qE 'safeMkdirAndRename|safeMkdirInIntent|mkdirNoFollow'
      packages/haiku/src/http/path-safety.ts
  - name: v04-helper-used-by-human-write-and-upload-routes
    command: >-
      bash -c 'grep -qE "safeMkdirAndRename|safeMkdirInIntent|mkdirNoFollow"
      packages/haiku/src/state-tools.ts && grep -qE
      "safeMkdirAndRename|safeMkdirInIntent|mkdirNoFollow"
      packages/haiku/src/http/upload-routes.ts'
  - name: v04-symlink-escape-test-named
    command: >-
      grep -qE 'symlink.*escape|symlink.*reject|TOCTOU|race.*symlink'
      packages/haiku/test/state-tools-handlers.test.mjs
      packages/haiku/test/upload-routes.test.mjs 2>/dev/null
  - name: v08-query-param-token-rejected-on-mutating-routes
    command: >-
      grep -qE
      'query_param_token_disallowed|disallowedOnMutating|rejectQueryToken'
      packages/haiku/src/http/auth.ts
  - name: v08-origin-allowlist-check
    command: >-
      grep -qE
      'HAIKU_ALLOWED_ORIGINS|originAllowlist|requireOriginAllowlist|checkOrigin'
      packages/haiku/src/http/auth.ts
  - name: v08-csrf-nonce-check
    command: >-
      grep -qE 'X-Haiku-CSRF|requireCsrfNonce|csrfNonce|CSRF_NONCE_HEADER'
      packages/haiku/src/http/auth.ts
  - name: v08-mutating-route-audit-script
    command: test -f packages/haiku/scripts/audit-mutating-routes.mjs
  - name: v08-csrf-test-named
    command: >-
      grep -qE 'csrf|missing.*Origin.*reject|query.*param.*token.*reject'
      packages/haiku/test/http-feedback.test.mjs
      packages/haiku/test/upload-routes.test.mjs 2>/dev/null
  - name: v10-feedback-body-sanitized
    command: >-
      grep -qE 'sanitizeFeedbackBody|stripDangerousMd|sanitize.*body|DOMPurify'
      packages/haiku/src/http/feedback-api.ts
  - name: v11-baseline-corrupt-operator-ack-required
    command: >-
      grep -qE
      'baseline_corrupt_acknowledged|requireOperatorAck|reconstructPriorBaseline'
      packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - name: v11-no-silent-auto-establish-after-corrupt
    command: >-
      bash -c '! grep -qE
      "baseline_corrupt.*silent.*establish|silent.*establish.*after.*corrupt"
      packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts'
  - name: haiku-suite-passes
    command: bun run --cwd packages/haiku test
status: completed
bolt: 1
hat: blue-team
started_at: '2026-05-03T02:09:47Z'
hat_started_at: '2026-05-03T03:02:52Z'
iterations:
  - hat: threat-modeler
    started_at: '2026-05-03T02:09:47Z'
    completed_at: '2026-05-03T02:14:11Z'
    result: advance
  - hat: security-engineer
    started_at: '2026-05-03T02:14:11Z'
    completed_at: '2026-05-03T02:48:06Z'
    result: advance
  - hat: security-reviewer
    started_at: '2026-05-03T02:48:06Z'
    completed_at: '2026-05-03T02:51:30Z'
    result: advance
  - hat: red-team
    started_at: '2026-05-03T02:51:30Z'
    completed_at: '2026-05-03T03:02:52Z'
    result: advance
  - hat: blue-team
    started_at: '2026-05-03T03:02:52Z'
    completed_at: '2026-05-03T08:10:20Z'
    result: advance
completed_at: '2026-05-03T08:10:20Z'
---
# Unit 03 — Symlink TOCTOU + layered CSRF + feedback sanitization + baseline-corrupt operator gate

## Scope

Close four vuln-report findings:

- **V-04 (MED)** `haiku_human_write` symlink-escape check skips when parent dir doesn't exist; `mkdirSync(recursive: true)` then follows planted symlinks. SAME pattern in `upload-routes.ts:413-454`.
- **V-08 (MED)** No CSRF protection on POST routes; `?t=<jwt>` query-param token + multipart-form-data + no Origin check.
- **V-10 (LOW)** `feedback_creates[].body` from agent isn't sanitized server-side.
- **V-11 (LOW)** baseline-corrupt → silent auto-establish on next tick is an attacker primitive.

## V-04 mitigation — race-free helper, both call sites

Pre-execute review correctly flagged that `realpathSync.startsWith(intentRoot)` is race-prone and that the SPA upload path has the same vuln pattern as the MCP tool.

1. Add `safeMkdirAndRename(intentRoot, parent, tmpPath, destPath)` to `path-safety.ts`. Implementation uses `O_DIRECTORY | O_NOFOLLOW` + `openat`/`renameat`-style semantics (Node `fs.openSync` with `O_NOFOLLOW`, then writes via the fd) so a concurrent symlink swap fails the open rather than escapes.
2. Both `haiku_human_write` (state-tools.ts) AND `upload-routes.ts:413-454` use the helper.
3. Test: planted symlink at parent dir is rejected; concurrent symlink swap test (multi-tick) fails the write.

If `O_NOFOLLOW`-everywhere isn't feasible on the target Node runtime, fall back to single-shot `realpathSync` check + document residual race-window risk in unit-04 ASSESSMENTS.md (deferred to follow-up).

## V-08 mitigation — three layers, not one

Pre-execute review flagged that the original "Origin check only" plan dropped the strongest layer (query-param token ban) and the defense-in-depth nonce.

1. **Reject `?t=<jwt>` on POST/PUT/DELETE** in `requireTunnelAuth`/`auth.ts` — return 401 `query_param_token_disallowed_on_mutating_route`. SPA must move to `Authorization: Bearer` for mutations (auth.ts:17-28 already supports it).
2. **Origin allowlist** — `HAIKU_ALLOWED_ORIGINS` env (default `http://localhost:*`); reject mutating requests with missing/non-allowed Origin.
3. **Per-session CSRF nonce** baked into SPA bootstrap, required as `X-Haiku-CSRF` header on mutations.

Implement as a single Fastify `preHandler` registered globally for tunnel mode (Origin + CSRF + query-param ban). Add `scripts/audit-mutating-routes.mjs` that enumerates every `app.post|put|patch|delete` registration and asserts the preHandler is in scope.

## V-10 mitigation

`feedback_creates[].body` from agent path: add server-side sanitization in `feedback-api.ts` that strips `<script>`, `<iframe>`, `<object>`, dangerous attributes (`on*=`, `javascript:`). Mirror the SPA's input-side rendering rules — keep markdown safe.

## V-11 mitigation — operator-only ack with reconstructed baseline diff

Pre-execute review flagged that "agent sets `baseline_corrupt_acknowledged`" is exactly the V-11 attacker primitive in disguise.

1. On `baseline_corrupt`, gate refuses to silent-establish.
2. `reconstructPriorBaseline(intentDir, stage)` rebuilds the last-known-good baseline from `baseline-content/` + `action-log.jsonl`.
3. Operator-only path (`/haiku:repair --confirm-baseline-reset --diff-shown`) presents reconstructed-vs-on-disk diff and requires the operator to confirm the specific diff hash. The agent CANNOT set `baseline_corrupt_acknowledged` directly.
4. Rate-limit / circuit-breaker: more than 3 baseline corruptions in 10 ticks emits `haiku.security.baseline_thrash` telemetry and disables auto-recovery.

## Completion criteria

See `quality_gates:` in frontmatter. Plus full `bun run --cwd packages/haiku test` passes.

## Out of scope (deferred to unit-04 ASSESSMENTS.md residual risk)

- Rate-limiting/abuse-prevention on the SPA upload + MCP surfaces — folded into a follow-up `unit-05-rate-limiting` referenced by ASSESSMENTS.md `stage_revisit` FB.

## References

- VULN-REPORT.md V-04, V-08, V-10, V-11
- `packages/haiku/src/http/auth.ts`, `path-safety.ts`, `upload-routes.ts`, `feedback-api.ts`
- `packages/haiku/src/state-tools.ts` (haiku_human_write)
- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts`, `drift-detection-gate.ts`
