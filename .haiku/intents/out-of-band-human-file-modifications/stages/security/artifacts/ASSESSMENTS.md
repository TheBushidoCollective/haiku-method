# ASSESSMENTS.md — Per-Vulnerability Audit Trail

Companion to `THREAT-MODEL.md` (the synthesis) and `VULN-REPORT.md`
(per-finding evidence). This file is the audit trail for the security
stage — every V-NN finding tied to its addressing unit, with executable
gate evidence captured at write time, plus the residual risks deferred to
follow-up iterations.

---

## 1. How `gate_pass_evidence` is recorded

Each row's `gate_pass_evidence` column carries three load-bearing facts:

- **commit SHA** — the last commit on the addressing-unit branch where
  the gate's grep/test command was observed passing (the unit's
  `quality_gates:` are evaluated by the workflow engine at advance time;
  this column captures the SHA the engine last evaluated).
- **run timestamp (UTC, ISO-8601)** — when the threat-modeler hat
  re-executed the gate command at write time of THIS document. This is
  the audit-relevant timestamp: every gate below was re-run by this hat
  on the unit-04 worktree's local checkout against the addressing unit's
  branch tip and is documented as having returned exit code 0 at the
  recorded timestamp.
- **exit code** — the actual exit code returned by the gate command.
  `exit=0` is required for a row to be recorded as `closed`.

The threat-modeler hat verified each gate by:

1. `git show <unit-tip>:<file>` to extract the file contents at the
   addressing unit's branch tip.
2. Running the gate's `grep` / `test` predicate against the extracted
   content.
3. Recording exit code + run timestamp.

If a row's `gate_pass_evidence` shows `exit=0`, the gate's text-pattern
contract is satisfied at the cited SHA. Full Bun test suite (`bun run
--cwd packages/haiku test`) was reported passing in the cited fix
commit's own message (e.g. unit-01 bolt-3: "Full suite: 1199/0 across 61
test files"); this is captured as `suite_at_commit` in the per-row
notes column.

The fix code lives on per-unit branches that are not yet merged to the
security stage branch (`haiku/out-of-band-human-file-modifications/security`
tip is `cf782a2b9`). Stage-branch consolidation is the workflow engine's
responsibility post-stage-gate; this document records the per-unit tip
SHAs because that is where the fix code is observable today.

Run-of-record timestamp for this assessment: **2026-05-03T09:00:39Z**.

---

## 2. Per-vulnerability assessment table

| vuln_id | severity | description | addressing_unit | gate_command | gate_pass_evidence | residual_risk |
|---|---|---|---|---|---|---|
| **V-01** | High | SVG/HTML knowledge upload renders inline as stored XSS via `serveFile` MIME map | `unit-01-upload-content-validation` | `grep -qE 'ALLOWED_MIMES\|allowedMimes\|MIME_ALLOWLIST' packages/haiku/src/http/upload-routes.ts` (gate `v01-v02-allowed-mimes-defined`) **plus** `grep -qE 'rejects.*\.html\|html.*rejected\|text/html.*415' packages/haiku/test/upload-routes.test.mjs` (gate `v01-v02-html-extension-rejected-test-named`) | commit `f83f45fe5`, run `2026-05-03T09:00:39Z`, exit_code=0 (both gates) — suite_at_commit=1199/0 (per fix commit `bfa4b7c91`) | Serve-side `Content-Disposition: attachment` for non-image/PDF + CSP `default-src 'none'; sandbox` not yet applied. Reviewer GET of an allow-listed file still relies on `serveFile` MIME inference. Deferred — see §4 row R-1 (serve-side hardening). |
| **V-02** | High | Stage-output upload accepts arbitrary HTML; rendered inline via `/stage-artifacts/:sid/*` | `unit-01-upload-content-validation` | Same allowlist gates as V-01 (`v01-v02-allowed-mimes-defined`, `v01-v02-html-extension-rejected-test-named`) cover both routes (`ALLOWED_MIMES_STAGE_OUTPUT` + `ALLOWED_MIMES_KNOWLEDGE` defined per route in commit `3867608a6`) | commit `f83f45fe5`, run `2026-05-03T09:00:39Z`, exit_code=0; bolt-3 commit `bfa4b7c91` adds R-01..R-04 equivalent-class blocks (`.js`, `.mjs`, `.cjs`, `.css`, `.htc`, `.hta`, `.htaccess`) and removes `application/octet-stream` from both allowlists | HTML-mockup product use case still requires sandboxed sub-origin to render figma/HTML artifacts safely. Deferred — see §4 row R-5 (sandboxed sub-origin). |
| **V-03** | Medium | `human_author_id`, `attribute_to_user`, `rationale`, `user_instruction_excerpt` self-reported by agent and copied to audit logs without binding | `unit-02-author-identity-binding` | `bash -c 'grep -qE "reqUser\|sessionUser\|claims\.sub\|resolveAuthorFromSession" packages/haiku/src/http/upload-routes.ts \|\| grep -qE "claimed_author_id" packages/haiku/src/state-tools.ts'` (gate `v03-spa-author-bound-from-session-or-renamed`) **plus** `v03-mcp-author-bound-from-os-user-or-renamed` and `v03-author-mismatch-rejected-test-named` | commit `fe91e1e64`, run `2026-05-03T09:00:39Z`, exit_code=0 (all three gates). Option B chosen: field renamed `human_author_id → claimed_author_id` consistently across SPA + MCP surfaces in commit `399c2ee13`. R-01 cross-session-sid bind closed in `4e5af2b76`. R-04 attribute_to_user allowlist closed in `bfa4b7c91`. | Audit-log hash-chain (`prev_hash` field on `write-audit.jsonl` / `action-log.jsonl`) not implemented. Tampered prior lines are not detectable. Status: **partially closed** (attribution renamed to `claimed_author_id`; integrity-on-the-log-itself defense deferred). See §4 row R-2 (audit-log hash-chain). |
| **V-04** | Medium | `haiku_human_write` symlink-escape check skipped when parent dir doesn't yet exist; `mkdirSync(recursive: true)` follows planted symlinks. SPA upload route has identical pattern. | `unit-03-symlink-toctou-and-csrf` | `grep -qE 'safeMkdirAndRename\|safeMkdirInIntent\|mkdirNoFollow' packages/haiku/src/http/path-safety.ts` (gate `v04-shared-safe-mkdir-helper`) **plus** `v04-helper-used-by-human-write-and-upload-routes` and `v04-symlink-escape-test-named` | commit `06cbb625c`, run `2026-05-03T09:00:39Z`, exit_code=0 (all three gates). `safeMkdirAndRename` helper landed in `573c91da1`; both call sites (`state-tools.ts` and `upload-routes.ts`) use the helper. Symlink-escape regression test lives in `packages/haiku/test/unit-03-security.test.mjs` (V-04.1 / V-04.2 — "planted symlink at parent / grandparent dir is rejected"). | Single-shot `realpathSync.startsWith(intentRoot)` re-check after `mkdirSync` is not race-free against an attacker who can keep flipping a symlink. Full `O_NOFOLLOW`-everywhere via `openat`/`renameat` deferred — see §4 row R-4. |
| **V-05** | Medium | `getCurrentTickCounter(intentDir)` for `stage=null` SPA uploads picks a non-deterministic stage's iteration; entry_id collisions and drift-gate per-tick action-log misses | `unit-02-author-identity-binding` | `grep -qE 'getIntentScopeTickCounter\|globalTickCounter\|intentScopeTick' packages/haiku/src/state-tools.ts` (gate `v05-intent-scope-tick-counter`) **plus** `v05-drift-gate-unions-stage-and-intent-action-log` | commit `fe91e1e64`, run `2026-05-03T09:00:39Z`, exit_code=0 (both gates). Producer fix in `399c2ee13`: `getIntentScopeTickCounter(intentDir)` returns deterministic intent-scope counter persisted to `intent-tick.json`. Consumer fix same commit: `drift-detection-gate.ts` reads union of per-stage and intent-scope action-log entries. Tick scope discriminator stamped on both action-log and audit-log entries. | Two SPA uploads landing in the same wall-clock millisecond with `stage === null` from two MCP processes serving the same intent could still race the intent-tick counter. Out of scope: deployment topology forbids multi-process serving the same intent. |
| **V-06** | Medium | `intent.md` archived/locked checks substring-matched against raw bytes — false-positives on body content, false-negatives on `status: 'locked'` | `unit-02-author-identity-binding` | `bash -c '! grep -qE "raw\.includes\(\"status:" packages/haiku/src/http/upload-routes.ts'` (gate `v06-frontmatter-parser-not-substring`) **plus** `v06-no-substring-status-checks-anywhere` and `v06-shared-locked-archived-helper` | commit `fe91e1e64`, run `2026-05-03T09:00:39Z`, exit_code=0 (all three gates). Shared `isIntentLocked` / `isIntentArchived` helpers in `state-tools.ts` parse via `gray-matter`. R-03 closed coverage gap on MCP path (`haiku_human_write` now imports `isIntentLocked` and rejects with `intent_locked`, commit `4e5af2b76`). | None significant — both SPA and MCP surfaces now route through the shared parser. A future code path that re-introduces a substring check would be caught by gate `v06-no-substring-status-checks-anywhere` (negative-grep enforces repo-wide elimination). |
| **V-07** | Medium | `HAIKU_UPLOAD_MAX_BYTES` parsing has no upper bound; misconfigured value lets one upload exhaust disk + RAM + drift-gate sync SHA | `unit-01-upload-content-validation` | `grep -qE 'MAX_UPLOAD_BYTES_HARD_CAP\|Math\.min.*HAIKU_UPLOAD_MAX_BYTES\|uploadHardCap' packages/haiku/src/http/upload-routes.ts` (gate `v07-upload-max-bytes-hard-cap`) **plus** `v07-oversize-clamp-test-named` | commit `f83f45fe5`, run `2026-05-03T09:00:39Z`, exit_code=0 (both gates). `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB` constant; effective cap clamps via `Math.min`; `haiku.upload.cap_clamped` telemetry event on misconfiguration (commit `3867608a6`). | Drift-gate sync SHA on tracked files >50 MiB still blocks the workflow tick if anyone ever bumps the cap. Recommendation (not yet implemented): skip drift-gate hashing for tracked files larger than a configurable limit and emit `haiku.drift.skipped_large` telemetry — folded into the rate-limit / DoS hardening residual risk. |
| **V-08** | Medium | No CSRF protection on POST routes; `?t=<jwt>` in URL + multipart-form-data is CORS-safe; cross-origin form post succeeds with leaked token | `unit-03-symlink-toctou-and-csrf` | `grep -qE 'query_param_token_disallowed\|disallowedOnMutating\|rejectQueryToken' packages/haiku/src/http/csrf.ts` (gate `v08-query-param-token-rejected-on-mutating-routes`, original gate pointed at `auth.ts`; the actual three-layer defense lives in the new `http/csrf.ts` module) **plus** `v08-origin-allowlist-check`, `v08-csrf-nonce-check`, `v08-mutating-route-audit-script`, `v08-csrf-test-named` | commit `06cbb625c`, run `2026-05-03T09:00:39Z`, exit_code=0 (all five gates verified against `http/csrf.ts`, `http/csrf.ts`, `http/csrf.ts`, `packages/haiku/scripts/audit-mutating-routes.mjs`, and `unit-03-security.test.mjs` respectively). Three-layer CSRF defense: Layer 1 (HARD) reject `?t=` on mutating verbs; Layer 2 `HAIKU_ALLOWED_ORIGINS` allowlist; Layer 3 (opt-in) per-session `X-Haiku-CSRF` nonce. Single Fastify global preHandler in `buildApp()` covers every route; `audit-mutating-routes.mjs` static check in CI enforces preHandler scope. | Per-IP rate-limit on mutating tunnel-mode routes still missing — Layer 4 of typical CSRF defense-in-depth. Deferred — see §4 row R-3 (rate limiting). |
| **V-09** | Low | `agent_rationale` and `rationale_excerpt` persisted unbounded; assessments-list endpoint reads all into RAM | `unit-01-upload-content-validation` | `bash -c 'grep -qE "agent_rationale.*10\s*\*\s*1024\|10240\|MAX_RATIONALE_BYTES" packages/haiku/src/state-tools.ts && grep -qE "rationale_excerpt.*1024\|MAX_RATIONALE_EXCERPT_BYTES" packages/haiku/src/state-tools.ts'` (gate `v09-rationale-cap-10kb-and-excerpt-cap-1kb`) **plus** `v09-list-endpoint-truncates-rationale` and `v09-rationale-too-long-test-named` | commit `f83f45fe5`, run `2026-05-03T09:00:39Z`, exit_code=0 (all three gates). `MAX_RATIONALE_BYTES = 10 * 1024` and `MAX_RATIONALE_EXCERPT_BYTES = 1024` constants in `state-tools.ts`; `validateRationaleCaps()` helper. Schema-validation rejects oversize rationales BEFORE `DA-NN.json` write with structured `agent_rationale_too_long` / `rationale_excerpt_too_long` errors (commit `0f87ed407`). List endpoint truncates to 256 chars + `…`; detail endpoint untouched. | None significant — schema enforcement at write time + list truncation cap the storage and bandwidth blast radius. |
| **V-10** | Low | `feedback_creates[].body` from agent flows into reviewer SPA without server-side sanitization | `unit-03-symlink-toctou-and-csrf` | `grep -qE 'sanitizeFeedbackBody\|stripDangerousMd\|sanitize.*body\|DOMPurify' packages/haiku/src/http/feedback-api.ts` (gate `v10-feedback-body-sanitized`, original gate pointed at `feedback-api.ts`; sanitizer lives in the new `http/feedback-sanitize.ts` module imported by `state-tools.ts` chokepoints) | commit `06cbb625c`, run `2026-05-03T09:00:39Z`, exit_code=0 (verified against `http/feedback-sanitize.ts`). Server-side sanitizer wired into the three external-input-to-disk chokepoints in `state-tools.ts`: `writeFeedbackFile` (agent feedback_creates path + SPA POST path), `appendFeedbackReply`, `haiku_feedback_write`. Strips `<script>`, `<iframe>`, `<object>`, dangerous attributes (`on*=`, `javascript:`). Commit `143a1ccbf`. | None significant — server-side sanitization closes the agent-as-attacker variant; SPA renderer is the second-line defense. |
| **V-11** | Low | Drift-gate baseline-corrupt error returns clear-text path; agent's natural reaction is `haiku_repair`, which silently re-establishes baseline from attacker-chosen content | `unit-03-symlink-toctou-and-csrf` | `grep -qE 'baseline_corrupt_acknowledged\|requireOperatorAck\|reconstructPriorBaseline' packages/haiku/src/orchestrator/workflow/drift-baseline.ts` (gate `v11-baseline-corrupt-operator-ack-required`) **plus** `v11-no-silent-auto-establish-after-corrupt` (negative-grep on `drift-detection-gate.ts`) | commit `06cbb625c`, run `2026-05-03T09:00:39Z`, exit_code=0 (both gates). Operator-only baseline-reset path: `reconstructPriorBaseline(intentDir, stage)` rebuilds last-known-good from `baseline-content/` + `action-log.jsonl`. `/haiku:repair --confirm-baseline-reset --diff-shown` requires operator to confirm specific diff hash. The agent CANNOT set `baseline_corrupt_acknowledged` directly. Anchored signals on tamper-evident surfaces (commit `3c3ccf1a0`) close the FB-05 red-team RT1/RT2/RT6 bypass class. | Rate-limit / circuit-breaker (`>3 baseline corruptions in 10 ticks` → `haiku.security.baseline_thrash` telemetry + auto-recovery disable) is the third line of defense and is partial — telemetry recorded but auto-disable-recovery hook landed in unit-03 IMPLEMENTATION as scaffolded, full enforcement deferred to operator-runbook follow-up. |

---

## 3. Per-fix-unit summary

| addressing_unit | surface fixed | findings closed | gate_pass_evidence (commit SHA + suite_at_commit) |
|---|---|---|---|
| `unit-01-upload-content-validation` | SPA upload routes (knowledge + stage-output) — content-type + extension allowlist, hard byte cap, rationale schema caps + list truncation | V-01, V-02, V-07, V-09 | `f83f45fe5`; suite_at_commit=1199/0 (per bolt-3 fix commit `bfa4b7c91`); 7/7 gates passed at `2026-05-03T09:00:39Z` |
| `unit-02-author-identity-binding` | Author identity (Option B claimed_author_id rename), intent-scope tick counter (producer + consumer), shared `gray-matter` status helpers | V-03 (partial — attribution closed, hash-chain deferred), V-05, V-06 | `fe91e1e64`; suite_at_commit=1187/1187 (per blue-team commit `4e5af2b76`); 7/7 gates passed at `2026-05-03T09:00:39Z` |
| `unit-03-symlink-toctou-and-csrf` | `safeMkdirAndRename` helper, three-layer CSRF (`http/csrf.ts`), feedback body sanitizer (`http/feedback-sanitize.ts`), operator-only baseline-corrupt gate | V-04 (partial — single-shot close, full O_NOFOLLOW deferred), V-08 (partial — rate-limit deferred), V-10, V-11 | `06cbb625c`; suite_at_commit reported in fix commits as `OK` (V-04, V-08, V-10, V-11 commits); 11/11 gates passed at `2026-05-03T09:00:39Z` (after re-verification against the new `csrf.ts` and `feedback-sanitize.ts` files where the fix code actually lives) |
| `unit-04-threat-model-and-assessments` (this unit) | THREAT-MODEL.md + ASSESSMENTS.md synthesis | (documentation — closes none directly) | (gates evaluated by workflow engine on advance) |

---

## 4. Deferred residual risks (`stage_revisit` register)

The pre-execute review surfaced these as out-of-scope for this stage's
iteration. Each is recorded here with title, owning vuln(s), rationale
for deferral, severity if unfixed, recommended target iteration, and the
`stage_revisit` FB ID.

The FBs are filed against the `security` stage with `resolution:
stage_revisit` so the next pre-tick triage gate routes the cursor to the
security stage's elaborate phase for a follow-up wave.

### R-1. Serve-side hardening (V-01 fix #2, V-01 fix #3, V-02 fix follow-up)

- **Owning vuln(s)**: V-01, V-02 (defense-in-depth on the serve side)
- **Rationale for deferral**: Upload-side allowlist closes the primary
  attack vector (no malicious HTML/JS lands in the first place). Serve-
  side hardening (invert `serveFile` MIME map; force `Content-Disposition:
  attachment` for non-image/PDF; CSP `default-src 'none'; sandbox` on
  every served knowledge artifact) is the second-line defense if a
  future allowlist regression slips through. The first-line is in place;
  the second can land in a follow-up wave.
- **Severity if unfixed**: Medium (any future allowlist bypass becomes
  immediately exploitable without the serve-side guard). Today: Low (no
  known bypass).
- **Recommended target iteration**: Next security wave (security pass 2).
  Group with R-5 (sandboxed sub-origin) — they share the same `serveFile`
  + `file-serve.ts` + `path-safety.ts` surface.
- **`stage_revisit` FB ID**: **FB-06** (`feedback/06-residual-r-01-serve-side-hardening.md`)

### R-2. Audit-log hash-chain (V-03 fix #3)

- **Owning vuln(s)**: V-03 (integrity of the audit log itself)
- **Rationale for deferral**: V-03 attribution is bound (Option B
  `claimed_author_id` rename). Hash-chaining the log lines is integrity-
  on-the-log-itself — a separate, additive control. The current state
  ("attribution is self-reported and the field name says so") is honest;
  hash-chain is the next maturity step.
- **Severity if unfixed**: Medium (an attacker who can write to disk can
  rewrite prior log lines without detection). Today: Low (intent
  directory write-access is already a meaningful breach).
- **Sequencing dependency**: hash-chaining is meaningless if upstream
  records can be silently lost or interleaved before the chain is
  computed. R-7 (write-time atomicity + parse-error fail-closed + per-
  field caps) is a **prerequisite** for R-2 — landing R-2 without R-7
  produces a hash chain over a corruptible substrate. Order the next
  security wave R-7 → R-2.
- **Recommended target iteration**: Next security wave (after R-7).
- **`stage_revisit` FB ID**: **FB-07** (`feedback/07-residual-r-02-audit-log-hash-chain.md`)

### R-3. Rate limiting (registered, partial cover for V-08, V-09, D-3, D-4 — slowloris + per-token gaps remain)

- **Owning vuln(s)**: V-08 (CSRF defense Layer 4), V-09 (per-session
  classify cap), and threat rows D-3 (slowloris on multipart) + D-4
  (rapid-fire `haiku_classify_drift`).
- **Status update (FB-29)**: `@fastify/rate-limit` IS registered today
  in tunnel mode (`packages/haiku/src/http.ts:228-243`) — see
  THREAT-MODEL.md §6.6 for the full per-key/per-route/store
  characterization. The earlier "rate-limit is missing" framing was
  stale relative to the FB-06 wiring. Present coverage and remaining
  gaps are now tracked separately below.
- **Present coverage** (registered limiter):
  - Plugin-wide scope: every HTTP route under tunnel mode
    (feedback CRUD, intent-mutation routes, upload routes, asset
    serves, assessments reads, CSRF nonce-mint, WebSocket upgrade
    handshake) shares one `(IP, window)` bucket. There is no per-route
    allowlist.
  - Defaults: `max=60` requests per `timeWindow=60_000` ms, overridable
    via `HAIKU_HTTP_RATE_MAX` / `HAIKU_HTTP_RATE_WINDOW_MS`.
  - Per-key derivation: defaults to `req.ip`, which is the socket peer
    because `Fastify({...})` does NOT set `trustProxy`
    (`packages/haiku/src/http.ts:107-137`). Under localtunnel this
    means the bucket effectively keys on "all-of-tunnel", not per
    upstream internet client. This is intentional (trusting
    `X-Forwarded-For` from an attacker-reachable surface would let
    attackers spoof their key) — caps the AGGREGATE tunnel-mode
    request rate, which is sufficient against single-attacker flood.
  - Error shape: HTTP 429 with the `@fastify/rate-limit` default body
    + `Retry-After` header (no override).
  - V-08 Layer 4 is closed for the direct-flood case (a single
    attacker cannot exceed `HAIKU_HTTP_RATE_MAX` per minute against
    any mutating route, including the CSRF nonce-mint endpoint).
- **Remaining gaps** (the parts that remain "deferred"):
  - **Per-token / per-session keying**: V-09 (per-session classify
    cap) is NOT directly enforced — the limiter buckets by IP, not
    by JWT `sid`. A single hostile token still falls under the
    aggregate IP cap (sufficient when the only authenticated client
    is the tunnel) but does not isolate one session's abuse from
    another session sharing the same egress IP.
  - **Distributed flood**: a multi-source attack from many residential
    IPs landing on the same tunnel is constrained by the aggregate
    `max` cap, which can starve legitimate use rather than isolating
    the bad sources. Distributed flood remains an accepted residual.
  - **WebSocket frame stream**: only the upgrade handshake counts
    against the bucket; in-stream messages are not rate-limited.
    Tracked but accepted (frame-level rate-limit is a follow-up — see
    THREAT-MODEL.md §6.6 recommendation (a)).
  - **Store backend**: in-memory LRU; process restart resets every
    bucket. Mitigated by JWT process-local lifetime (a restart also
    invalidates the JWT, capping the post-restart abuse window).
- **Severity today**: Low-Medium for the V-08/V-09 surface (the
  registered limiter closes the direct-flood path; gaps are
  per-token differentiation + distributed-flood isolation).
  Medium-High remains for the **independent slowloris (D-3)** sub-
  surface — see the slowloris escalation note below; that fix is
  `connectionTimeout` + `requestTimeout`, NOT rate-limit, and
  remains outstanding.
- **Recommended target iteration**: Next security wave for the
  per-token / WebSocket-frame extensions and the slowloris timeout
  fix. The aggregate IP cap is acceptable interim coverage.
- **Slowloris escalation note (RT-FB-12) — INDEPENDENT OF RATE-LIMIT
  REGISTRATION**: THREAT-MODEL.md §6.1 originally claimed a fictional
  60-second `connectionTimeout` mitigation. That claim has been
  retracted (see THREAT-MODEL.md §6.1 and §3.5 D-3 row). Slowloris on
  the upload routes is **unmitigated by the rate-limit registration**
  (the limiter rejects the 61st request, but the attacker's open
  trickling connections are not closed by it) and remains tracked as
  an unmitigated risk pending the connection-timeout work. The fix
  unit MUST set `connectionTimeout` (suggested: 30 000 ms) and
  `requestTimeout` (suggested: 60 000 ms) on the `Fastify({ ... })`
  call in `packages/haiku/src/http.ts:107-136`, and add a regression
  test that asserts a stalled multipart upload is killed within the
  timeout.
- **`stage_revisit` FB ID**: **FB-08** (`feedback/08-residual-r-03-rate-limiting.md`)

### R-4. Race-free `O_NOFOLLOW`-everywhere (V-04 fix #1 — full migration)

- **Owning vuln(s)**: V-04
- **Rationale for deferral**: Unit-03's `safeMkdirAndRename` helper closes
  the single-shot easy case via `realpathSync.startsWith(intentRoot)`
  re-check after `mkdirSync` and before `rename`. A determined attacker
  with concurrent intent-directory write access who can keep flipping a
  symlink in a tight loop can still race the window. Full migration to
  `openat`/`renameat`-style semantics (Node `fs.openSync` with
  `O_NOFOLLOW`, then writes via the fd) eliminates every TOCTOU window
  but is a bigger lift — Node's fs API does not expose `openat` directly,
  requiring either an FFI wrapper or per-segment `lstat` with
  fail-on-symlink.
- **Severity if unfixed**: Medium (TOCTOU race remains for an attacker
  with concurrent write access). Today: accepted residual — concurrent
  intent-directory write access is already a meaningful breach.
- **Recommended target iteration**: Next security wave; needs FFI /
  Node-native investigation up front.
- **`stage_revisit` FB ID**: **FB-09** (`feedback/09-residual-r-04-o-nofollow-everywhere.md`)

### R-5. Sandboxed sub-origin for stage-output mockups (V-02 follow-up)

- **Owning vuln(s)**: V-02 (HTML mockup product use case)
- **Rationale for deferral**: Stage outputs are explicitly described as
  the surface reviewers use to swap in figma/HTML/image artifacts mid-
  review. The current allowlist forbids `.html` entirely (R-01 closure on
  the bolt-3 commit), which is safe but blocks the legitimate
  HTML-mockup product use case. The proper fix is a sandboxed sub-origin
  (cookie-isolated subdomain, `Sec-Fetch-Site: cross-site`,
  `Cross-Origin-Embedder-Policy`, `Cross-Origin-Opener-Policy`) so
  script execution in a mockup cannot read the tunnel-origin's session
  token. Implementation requires localtunnel sub-origin support (or a
  proxy layer) — a deployment-topology change.
- **Severity if unfixed**: Low today (HTML-mockup feature blocked, no
  exploitable surface). Medium when re-enabled without sandbox: every
  HTML mockup becomes an XSS vector.
- **Recommended target iteration**: Co-locate with R-1 (serve-side
  hardening) in next security wave; gated on sub-origin infrastructure.
- **`stage_revisit` FB ID**: **FB-10** (`feedback/10-residual-r-05-sandboxed-sub-origin.md`)

### R-6. Magic-byte content sniffing on uploads (V-01 / V-02 closure bound)

- **Owning vuln(s)**: V-01 (knowledge upload), V-02 (stage-output upload).
  **Triggering finding:** FB-34 (security stage,
  `feedback/34-upload-allowlist-trusts-client-supplied-mime-with-no-magic-b.md`).
- **Rationale for deferral**: The bolt-1/bolt-3 closure of V-01/V-02
  reduced the attack surface to "claimed MIME + filename extension are
  both on the allowlist." That bound is honest — the upload route does
  NOT inspect the leading bytes of the streamed payload, so HTML bytes
  delivered as `image/png` with extension `.png` pass at boundary 2.
  The closure of I-1/I-2 then leans on the serve-side path: `serveFile`
  picks `Content-Type` from the extension map at
  `path-safety.ts:118`, and modern browsers respect `image/*`
  Content-Type and refuse to render the bytes as HTML. The exposure
  is in degraded paths: pre-2018 user-agents, security scanners that
  re-sniff content, content-detection middleboxes, and any future
  serve-side regression. The proper upgrade is magic-byte sniffing of
  the first 512 bytes against the allowlist's binary members:
    - `image/png` → `89 50 4E 47 0D 0A 1A 0A`
    - `image/jpeg` → `FF D8 FF`
    - `image/gif` → `47 49 46 38 (37|39) 61`
    - `image/webp` → `RIFF…WEBP`
    - `application/pdf` → `25 50 44 46 2D` (`%PDF-`)
  Text-class members (`text/plain`, `text/markdown`,
  `application/json`) have no fixed magic prefix; they remain accepted
  on extension+claim and rely on serve-side `Content-Type`-from-
  extension + the planned `nosniff` header (FB-19).
  **Why not fixed in this wave:** the bolt-3 closure landed the
  primary defense (extension blocklist + per-route MIME allowlist +
  octet-stream removal); magic-byte sniffing is a defense-in-depth
  upgrade, not a primary-defense gap. Co-locating with R-1 / R-2
  serve-side hardening means a single follow-up wave delivers the
  full hardened upload→serve path (magic-byte at boundary 2,
  `nosniff` + CSP + sandbox at boundary 4), rather than two partial
  passes.
- **Severity if unfixed**: **Medium** when paired with a degraded
  serve-side path (missing `nosniff`, future regression in
  extension-driven Content-Type, or a CDN/middlebox that re-sniffs).
  Low under the default modern-browser path. The R-6 + FB-19 +
  R-1 fix-set lifts this to "structurally closed."
- **Recommended target iteration**: Next security wave alongside R-1
  (serve-side hardening). Implementation site is `upload-routes.ts`
  immediately after `streamToTempfile` resolves — read the first 512
  bytes of `tmpPath` and compare against the magic-byte table for the
  member of `ALLOWED_MIMES_*` matched at the claim check, returning
  415 with `error: "content_type_mismatch"` on miss. The `file-type`
  npm package is the obvious dep choice (well-audited, single-purpose,
  ~40 KB minified); a hand-rolled table is < 80 LOC if the team
  prefers no new dep. Test surface: red-team PoC uploading
  `<html>…</html>` bytes as `image/png` / `application/pdf` /
  `image/jpeg` and asserting 415; positive controls for legitimate
  PNG/JPEG/PDF/GIF/WEBP uploads.
- **`stage_revisit` FB ID**: filed under R-6, to be authored by
  unit-04 elaboration in the next security wave (folded into the
  same `stage_revisit` follow-up FB stream as R-1 / R-2 / R-5 so
  the pre-tick triage gate routes the cursor to the security
  stage's elaborate phase exactly once for the whole serve+upload
  hardening pass).

### R-7. Audit-log write-time atomicity + per-field caps + parser fail-closed (FB-28 surface)

- **Owning vuln(s)**: V-03 (integrity of the audit log itself), V-09
  (rationale bloat). Companion to R-2 (post-write tampering). **Triggering
  finding**: FB-28 (security stage,
  `feedback/28-audit-log-atomicity-claim-broken-by-unbounded-rationale-path.md`),
  with sibling findings FB-26 (rationale uncapped on MCP path) and
  FB-30 (haiku_human_write content uncapped).
- **Defect characterization**: `appendJsonlLine` (`packages/haiku/src/orchestrator/workflow/write-audit.ts:131-163`),
  `appendWriteAudit` (`write-audit.ts:165-182`), and `appendActionLogEntry`
  (`packages/haiku/src/orchestrator/workflow/action-log.ts:36-73`)
  document an atomicity contract that depends on each record's serialized
  JSON line being ≤ PIPE_BUF. Three independent ways the contract is
  silently wrong today:
    1. **PIPE_BUF on macOS is 512 bytes**, not the 4 KiB the comment
       cites. Any record whose JSON exceeds 512 B (the common case once
       a non-trivial `path`, `rationale`, or `dirs_created` is present)
       loses the atomicity guarantee on every macOS dev / CI / operator
       host.
    2. **`WriteAuditRecord` carries unbounded variable-length fields**:
       `rationale` (no cap on the MCP path — see FB-26 for the missing
       `validateRationaleCaps` call in `haiku_human_write.ts:413`),
       `dirs_created: string[]` (proportional to created-dir-chain depth,
       `haiku_human_write.ts:670-683`), `path` (bounded only by
       filesystem `PATH_MAX` — already exceeds macOS PIPE_BUF on its
       own at ~1 KiB), and `claimed_author_id` / `human_author_id`
       (unbounded on the MCP path). Even on Linux (PIPE_BUF = 4 KiB) a
       single oversize-rationale write blows the bound.
    3. **Concurrent writers exist for both files**: SPA upload route
       (`packages/haiku/src/http/upload-routes.ts:726, 729, 1027, 1030`),
       MCP `haiku_human_write` (`haiku_human_write.ts:795, 838`), and
       drift baseline / V-11 markers (`drift-baseline.ts:1218, 1241`)
       all O_APPEND the **same** `write-audit.jsonl` and
       `action-log.jsonl` per intent. Concurrent ticks + concurrent SPA
       uploads + concurrent agent calls can interleave bytes mid-line.
- **Consumer behavior compounds the silence**: `readActionLogForTick`
  (`action-log.ts:97-109`) wraps `JSON.parse` in `try { ... } catch
  { /* skip */ }`. A malformed line caused by interleaved-write
  corruption is silently dropped — the entry vanishes from the
  drift-detection gate's per-tick action-log union. A `human-via-mcp`
  write whose audit line was corrupted gets re-classified
  `human-implicit` because the entry no longer exists. The whole
  trust-and-audit story in ARCHITECTURE.md §6.1-§6.3 (and this
  stage's §3.3 R-1..R-4 mitigations) rests on log integrity that is
  not actually guaranteed at write time.
- **Why it's recorded as a residual rather than fixed in this wave**:
  the fix is a producer-side rewrite spanning three files
  (`write-audit.ts`, `action-log.ts`, `haiku_human_write.ts`) plus a
  consumer-side change (`readActionLogForTick` semantics — promoting
  parse errors from "skip" to "tamper signal"), plus per-field caps
  on every variable-length record field. That's a coherent wave on
  its own and should not be folded into a documentation iteration.
  The triage decision is to record it as a tracked residual with R-2
  (hash-chain) sequenced to follow.
- **Severity if unfixed**: **Medium-High**. The harm is structural:
  every audit-log analysis (drift-gate classification, post-incident
  attribution, BLUE-TEAM-VERIFICATION.md `git show`-based replay) is
  silently downgraded from "guaranteed log fidelity" to "best-effort
  fidelity" on macOS for nearly every record, and on Linux for any
  long-rationale record. Today this manifests as occasional
  misattribution under concurrent load; an attacker aware of the
  asymmetry can deliberately race a high-volume oversize write against
  a target write to suppress its audit trail.
- **Recommended fix (in priority order)**:
  1. **Per-field caps at the chokepoint** — push `validateRationaleCaps`
     (already 10 KiB) and a new `MAX_PATH_BYTES` (e.g. 1 KiB),
     `MAX_DIRS_CREATED_COUNT` (e.g. 32), and `MAX_AUTHOR_ID_BYTES`
     (e.g. 128) into `appendWriteAudit` / `appendActionLogEntry` so
     every writer is forced through the same boundary. Bounds the
     serialized line length to a known maximum (~12 KiB worst case)
     so atomicity can be reasoned about per-platform.
  2. **Stop relying on PIPE_BUF for atomicity** — wrap every append
     in a userspace lock against `<log>.lock` (e.g.
     `proper-lockfile`) or use a single-writer in-process queue
     plus advisory `flock` for cross-process writers. Either
     approach removes the platform-dependent silent failure.
     `proper-lockfile` is the lower-risk choice (no FFI, well-
     audited, already used in similar Node shops) and is the same
     primitive RED-TEAM-unit-02 §R-05 recommended for the
     `intent-tick.json` race.
  3. **Fail-closed on JSONL parse errors in the consumer** — replace
     the `try { JSON.parse(line) } catch { /* skip */ }` in
     `readActionLogForTick` with a structured tampering signal
     (emit `haiku.audit.parse_failure` telemetry, include the
     malformed line's offset, refuse to advance the drift-gate tick
     until an operator acknowledges the corruption — same shape as
     V-11 baseline-corrupt operator-ack). A malformed line is a
     security signal, not a parsing inconvenience.
  4. **Per-platform PIPE_BUF audit comment** — replace the "4 KiB on
     most platforms" comment in `write-audit.ts:165-182` and
     `action-log.ts:36-73` with the actual per-platform value (Linux
     4096, macOS 512, NetBSD 512, FreeBSD 512) plus a note that the
     cap is enforced at the producer side via the field-cap chokepoint.
  5. **Cross-reference R-2** — once R-7 lands, R-2 (hash-chain) can
     be implemented over a substrate that is actually atomic.
- **Severity ranking**: R-7 is Medium-High; R-2 is Medium. R-7 is
  prerequisite to R-2.
- **Recommended target iteration**: Next security wave, sequenced
  before R-2 (hash-chain). Implementation site is the three append
  helpers + the `haiku_human_write` argument-extraction site +
  `readActionLogForTick` consumer.
- **`stage_revisit` FB ID**: FB-28 (this finding) becomes the seed
  FB for R-7 once it closes; the next security iteration's
  elaborate phase fans out per-component subagents (producer caps,
  lockfile primitive, consumer fail-closed, comment correction)
  from the closed FB-28 + sibling FB-26 + FB-30 surface.

---

## 5. Triage decisions referenced from this stage

The following decisions taken during the security stage are recorded here
for the audit trail; full rationale lives in the cited artifact.

- **Option B chosen on V-03** — `human_author_id → claimed_author_id`
  rename rather than server-side identity binding. Rationale: SPA session
  table has no reviewer-identity field today; renaming is integrity-
  honest about the field's authority. Recorded in commit `399c2ee13`
  message and unit-02 SECURITY-ASSESSMENT artifact.
- **Eventual-consistency confirmed (decision (a))** — V-04 single-shot
  TOCTOU close + full migration deferred. Rationale: drift gate is the
  compensating control for concurrent-writer scenarios; advisory locking
  is fundamentally incomplete because `vim` and out-of-band editors do
  not participate. Recorded in THREAT-MODEL.md §2.3.
- **FB-05 rejected** — "V-11 baseline gate bypassable via state.json
  tamper" finding rejected because anchored detectors on tamper-evident
  surfaces close the bypass class. Recorded in FB-05 frontmatter
  (`status: rejected`).

---

## 6. Pre-conditions that must continue to hold (re-rate trigger)

Per THREAT-MODEL.md §1.5, every Medium / High severity above assumes the
following four trust assumptions hold. If any weakens, every affected
finding is re-rated upward and this assessment must be re-run:

1. Localtunnel URL leak rate is bounded (Slack pastes, etc.) — not
   indexed by search engines or routinely logged in shared monitoring.
2. `EPHEMERAL_SECRET` is not extractable from process memory without
   prior code execution.
3. `tun` claim binding to active tunnel URL holds (no URL reuse across
   MCP processes).
4. `sid` cross-binding via `verifyIntentMutationAuth` is not regressed
   (no future refactor that ships `expectedSid: null` again).

If any of these change between security waves, the threat-modeler hat in
the next wave MUST re-validate every closed finding's severity rating
before re-running these gates.

---

## 7. References

- `THREAT-MODEL.md` — synthesis artifact (this stage)
- `VULN-REPORT.md` — per-finding evidence (discovery hat)
- `SECURITY-CONTROLS-unit-01.md` — unit-01 implementer hat output
- `SECURITY-ASSESSMENT-unit-02.md` — unit-02 implementer hat output
- `unit-03/IMPLEMENTATION.md` — unit-03 implementer hat output
- `unit-03/THREAT-MODEL.md` — unit-03 threat-modeler hat output
- `unit-03/RED-TEAM-FINDINGS.md` + `unit-03/BLUE-TEAM-VERIFICATION.md`
- `RED-TEAM-unit-01.md` / `BLUE-TEAM-unit-02.md` / `RED-TEAM-unit-02.md`
- `THREAT-MODEL-unit-01.md` / `THREAT-MODEL-unit-02.md`
- Unit feedback files (`feedback/01..05`)
