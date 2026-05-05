# THREAT-MODEL.md — Out-of-Band Human File Modifications

Synthesis artifact for the security stage. Companion to `VULN-REPORT.md`
(per-finding evidence) and `ASSESSMENTS.md` (per-fix audit trail).

This document enumerates threats by STRIDE category against the entry-point
features delivered by this intent, names the trust regions that determine
severity, calls out third-party dependency risk, and records the
load-bearing assumptions every V-NN severity rests on.

---

## 1. Trust regions (the load-bearing axis)

VULN-REPORT calls this out explicitly: "If the THREAT-MODEL artifact
concludes the tunnel-mode trust boundary is weaker than assumed... every
Medium and High severity here may need to be revised upward." This section
is the source of truth that fixes the reference frame for every other
severity rating.

### 1.1. Local mode (loopback, fully trusted)

- **Network surface**: HTTP server bound to `127.0.0.1` only.
  `isRemoteReviewEnabled()` returns `false`; no public URL exists.
- **Auth posture**: `requireTunnelAuth` and `verifyFeedbackMutationAuth`
  short-circuit to `true`. Anything that can reach the loopback port
  already has localhost code-execution privilege and is assumed equivalent
  to the local user.
- **Trust verdict**: any caller is trusted-equivalent to the operator.
  Out-of-band file writes through SPA routes or `haiku_human_write` MCP
  tool are treated the same as the operator running `vim` on the file —
  the audit log records the action but does not gate it.
- **Implication for severity**: V-01, V-02, V-08 are downgraded to
  *informational* under local mode (no remote attacker can reach the
  routes). V-03, V-04, V-05, V-06, V-07, V-09, V-10, V-11 remain as rated
  because they are reachable by the agent itself or by misconfiguration.

### 1.2. Tunnel mode (JWT-bound, attacker-reachable)

- **Network surface**: server reachable over a public localtunnel URL
  (`https://<random>.loca.lt`). `isRemoteReviewEnabled()` returns `true`.
- **Auth posture**: every request must present an HS256 JWT signed with
  `EPHEMERAL_SECRET`. Token may be supplied as `Authorization: Bearer ...`
  or `?t=<jwt>` query-string (the query-param path is the V-08 CSRF root).
- **Trust verdict**: any caller is *partially trusted* — they have proof
  of holding a valid token at some point in the tunnel's lifetime, but
  token leakage is in-scope (Slack pastes, screenshots, accidental
  commits). Tokens scoped to one session can target writes to a different
  intent unless `verifyFeedbackMutationAuth` cross-checks (see V-03 R-01
  finding for the historical bypass on the upload routes).
- **Implication for severity**: every High and Medium in VULN-REPORT
  assumes tunnel mode unless the finding's text says otherwise. If any of
  the trust assumptions in §1.4 weakens, the severity rises.

### 1.3. `EPHEMERAL_SECRET` lifecycle

- **Generated**: `randomBytes(32)` at MCP server process start
  (`packages/haiku/src/tunnel.ts:11`). 256-bit HMAC key.
- **Rotated**: never within a process lifetime. Rotation only happens at
  process restart — a new secret invalidates every prior JWT.
- **Lifetime**: equal to the MCP server process. Long-running sessions
  (e.g. `bun haiku serve` left up overnight) keep the same secret for the
  full duration.
- **On rotation (process restart)**: every previously-minted token fails
  signature verification (`bad_signature`). Reviewers must re-bootstrap.
  This is also the *implicit* expiry mechanism for tokens whose `exp`
  claim outlives the process — restart wins over claim TTL.
- **Storage**: in-memory only; never written to disk, never logged.
  Process-memory disclosure (heap dump, debugger attach) is the only path
  to extract the secret without forging a valid token first.
- **Threat**: long-lived processes with frequent reviewer hand-offs widen
  the secret-leak blast radius — every compromised reviewer who pasted a
  token into Slack within the same process lifetime contributed to the
  same key's exposure surface. Mitigation: rotate the process on a
  schedule (deferred — see ASSESSMENTS.md).

### 1.4. JWT claim semantics (`tun` and `sid`)

- **`tun` claim**: bound to the currently-active localtunnel URL at mint
  time. `verifyTunnelJWT` rejects with `tunnel_mismatch` if the active
  tunnel has rotated. An attacker who captures a token issued for
  tunnel-A cannot replay it against tunnel-B (which has a different URL)
  even if both share the same `EPHEMERAL_SECRET`.
- **`sid` claim**: bound to the issuing review session. The intent-scoped
  `/api/review/current` route accepts any valid `sid`; mutating routes
  (uploads, feedback writes) use `verifyFeedbackMutationAuth` /
  `verifyIntentMutationAuth` to require `sid` matches the URL's intent
  slug. Pre-R-01 fix (unit-02 blue-team), the SPA upload routes called
  `requireTunnelAuth` with `expectedSid: null`, allowing cross-session
  writes — that bypass is closed at commit `4e5af2b76`.
- **What an attacker cannot forge**: signature (no key access), `tun`
  rebind (active tunnel URL is server-controlled), `exp` extension
  (signature breaks on edit). Algorithm-confusion (`alg: none`) is
  rejected by explicit header validation (`tunnel.ts:135-148`).
- **What an attacker can do with a leaked token**: every action the
  binding `(tun, sid)` permits, until either the process restarts (kills
  `EPHEMERAL_SECRET`) or `exp` passes. That includes uploads, feedback
  writes, and audit-log poisoning via `attribute_to_user` / `claimed_author_id`.
- **Token visibility**: tokens travel in URLs (`?t=`) for cross-tab SPA
  links. URL-bound tokens are visible to browser history, server logs
  (Origin proxy chain), and screen captures. Mitigation: ban `?t=` on
  mutating verbs (V-08 fix #1, landed in unit-03).

### 1.5. Consequence rule (must hold for severities below to stand)

If any of the following weakens, every Medium and High in VULN-REPORT
must be re-rated upward:

1. The localtunnel URL leak rate is materially higher than "sometimes
   pasted in Slack" (e.g. routinely indexed by search engines, logged in
   shared monitoring) — if so, the V-08 CSRF surface widens because the
   attacker doesn't need to phish the URL.
2. The `EPHEMERAL_SECRET` is somehow extractable from process memory
   without prior code execution (heap dump in a multi-tenant container,
   debug endpoint) — if so, every signature guarantee collapses and
   every JWT-protected route becomes attacker-callable.
3. The `tun` claim binding becomes weaker (e.g. localtunnel URL is
   reused across MCP processes, defeating the post-restart invalidation)
   — if so, token reuse across processes becomes possible.
4. `sid` cross-binding regresses (e.g. a future refactor ships
   `verifyIntentMutationAuth` with `expectedSid: null` again) — if so,
   the cross-session write bypass returns at full severity.

This is the contract: as long as the four assumptions hold, severities
in VULN-REPORT are correct. ASSESSMENTS.md records the regression-test
gates that prove each assumption is enforced today.

---

## 2. Concurrency model — eventual consistency, accepted

The intent goal sentence "Concurrency model is eventual-consistency: no
locking, the next `haiku_run_next` tick observes drift" is load-bearing
for V-04 (TOCTOU symlink) and V-05 (tick-counter determinism).

**Decision**: option (a). Confirm eventual-consistency is the intentional
design, accept the residual TOCTOU window from V-04 as documented in the
deferred-risk register.

### 2.1. Why eventual consistency

- The MCP server, the SPA upload route, the agent (via `haiku_human_write`),
  and out-of-band human edits (`vim`, `git checkout`) all write to the
  same intent directory. A locking primitive that covers all four would
  need to be a pid-aware advisory lock (e.g. `flock`) honored by every
  writer — `vim` does not honor `flock`, so the locking primitive is
  fundamentally incomplete.
- The drift gate is the compensating control: every tick re-hashes
  tracked surface and reconciles against the baseline + action log. The
  gate runs *after* writes, observing the post-write state regardless of
  ordering.

### 2.2. Residual risk accepted

- **V-04 TOCTOU window**: the symlink-escape race between
  `lstat`-validation and `mkdirSync` / `rename` cannot be fully closed
  without `O_NOFOLLOW`-everywhere via `openat`/`renameat`. Unit-03's fix
  (`safeMkdirAndRename` helper, commit `573c91da1`) closes the
  single-shot easy case via `realpathSync` re-check after `mkdirSync` and
  before `rename`. A determined attacker holding write access to the
  intent directory and able to keep flipping a symlink in tight loop can
  still race. Acceptance rationale: an attacker with concurrent
  intent-directory write access has already breached a layer that the
  server treats as trusted.
- **V-05 entry-id collision window**: closed by
  `getIntentScopeTickCounter(intentDir)` (unit-02, commit `399c2ee13`)
  for SPA uploads with `stage === null`. The drift-gate consumer reads
  the union of per-stage and intent-scope action-log entries so author
  classification routes correctly. Residual: two SPA uploads landing in
  the same wall-clock millisecond with `stage === null` still race the
  intent-tick counter inside the function — but the counter is
  `intent-tick.json`-backed and incremented under a single
  process-monotonic call, so collision requires two MCP processes
  serving the same intent (out of scope: deployment topology forbids).

### 2.3. Locking primitive consideration (rejected)

A POSIX advisory lock around the intent directory would close V-04 fully
but introduces three new failure modes: (a) lock-holder process crash
strands the lock; (b) `vim` and out-of-band editors do not participate;
(c) the locking layer becomes a single-process serializer for an
inherently concurrent SPA-plus-MCP flow. The compensating-control
posture (drift gate observes drift) is preferable.

---

## 3. STRIDE threat catalog (rows mapped to entry-point features)

Each STRIDE category has at least one threat row tied to a named
entry-point feature. Rows cite the V-NN finding from VULN-REPORT
where applicable.

### 3.1. Spoofing — author/identity forgery

| # | Threat | Feature | V-NN | Notes |
|---|---|---|---|---|
| S-1 | Agent passes `claimed_author_id` it invented; audit log records the forgery as authoritative | `agent-writes-on-behalf-of-human.feature` | V-03 | Unit-02 picked Option B — field renamed `human_author_id → claimed_author_id`. Consumers now read "what the caller claimed" rather than treating it as proof. |
| S-2 | SPA reviewer holding a leaked tunnel JWT writes uploads attributed to a forged `attribute_to_user` (e.g. `ceo@company.com`) | `explicit-spa-upload.feature` | V-03 | Same Option B mitigation. R-04 (commit `bfa4b7c91`) further constrains the field to a printable-character allowlist so it can't carry HTML/script payloads into audit-log viewers. |
| S-3 | Tunnel JWT for session A replayed against intent B via cross-session URL | `explicit-spa-upload.feature` | V-03 R-01 | Closed by `verifyIntentMutationAuth` (commit `4e5af2b76`) — `sid` claim now cross-checked against URL intent slug on upload routes. |
| S-4 | `alg: none` / `alg: HS256+RS256` algorithm-confusion forgery | `explicit-spa-upload.feature` (auth surface) | (not in VULN-REPORT) | Closed in `tunnel.ts:135-148` — explicit `alg !== "HS256"` rejection plus HMAC verify path always uses HS256. |

### 3.2. Tampering — write-surface integrity

| # | Threat | Feature | V-NN | Notes |
|---|---|---|---|---|
| T-1 | TOCTOU symlink swap during `haiku_human_write` parent-mkdir → write race | `agent-writes-on-behalf-of-human.feature` | V-04 | Unit-03 `safeMkdirAndRename` + post-mkdir realpath re-check (commit `573c91da1`). Residual race accepted; full `openat`/`renameat` deferred. |
| T-2 | Same TOCTOU class on SPA upload route (`upload-routes.ts:413-454`) | `explicit-spa-upload.feature` | V-04 | Same fix call site — both call `safeMkdirAndRename`. |
| T-3 | Direct `state.json` tamper to bypass V-11 baseline gate (red-team finding FB-05) | `silent-filesystem-drop-detection.feature` | V-11 + RT1/RT2/RT6 | Unit-03 anchors signals on tamper-evident surfaces (commit `3c3ccf1a0`); FB-05 was rejected because anchored detectors close the bypass. |
| T-4 | `baseline.json` corruption → silent auto-establish on next tick re-baselines attacker-chosen content | `silent-filesystem-drop-detection.feature` | V-11 | Unit-03 operator-only baseline-reset path with reconstructed-vs-on-disk diff; agent CANNOT set `baseline_corrupt_acknowledged`. |
| T-5 | Substring-match status check on `intent.md` accepts non-canonical YAML formatting | `explicit-spa-upload.feature` | V-06 | Unit-02 shared `isIntentLocked` / `isIntentArchived` helpers parse via `gray-matter`. R-03 closed coverage gap on MCP path. |
| T-6 | `haiku_baseline_init` MCP tool re-baselines attacker-controlled content into `baseline.json` (silent-establish laundry against everything V-11 closes on the gate-side path) | `silent-filesystem-drop-detection.feature` | V-11 | Operator-callable MCP tool registered at `packages/haiku/src/tools/orchestrator/index.ts:13,26`. Sibling write-surface to `haiku_classify_drift` (see §5). Two modes: `establish-all` enumerates the entire tracked surface; `establish-paths` baselines only listed paths after validating each against the same allow-list `haiku_human_write` uses (denies workflow-managed files, drift-subsystem internals, and `path_escape` outside the intent dir at `haiku_baseline_init.ts:49-82`). Idempotency: files whose SHA already matches stored baseline are skipped; only NEW or CHANGED files cause a write (`haiku_baseline_init.ts:272-308`). Trust-boundary placement: in local mode this tool runs in the operator-trusted context (no remote attacker can reach the MCP socket). In tunnel mode there is no remote MCP exposure — MCP tool calls do not traverse the tunnel; only the SPA HTTP routes do. The remaining attacker model is therefore "hostile/buggy agent" rather than "remote attacker" (see §1.4 trust assumptions: agent is partially trusted under the local-mode reference frame in §1.1). Residual risk: the agent CAN call this tool. The operator-confirmation gate that `/haiku:repair --confirm-baseline-reset --diff-shown` enforces is NOT replicated at the MCP-tool layer — invoking `haiku_baseline_init` does not require operator confirmation. Compensating controls: (a) the tracked-surface allow-list bounds blast radius — drift-subsystem internals (`baseline.json`, `drift-markers.json`, `write-audit.jsonl`, `drift-assessments/`) and workflow-managed files (`intent.md`, `state.json`, `units/*.md`, `feedback/*.md`) cannot be baselined through `establish-paths`; (b) the SHA-idempotency check means a hostile agent cannot use this tool to "freeze" arbitrary content over an existing baseline entry without the change being visible as a new entry write. Gap accepted (deferred): no `baseline_corruption_event` action-log entry is emitted from `haiku_baseline_init` invocations the way the gate-side path emits when it detects baseline tamper — agent-driven re-baseline is silent at the action-log layer today. Tracked under FB-16 in ASSESSMENTS.md residual risk. |

### 3.3. Repudiation — audit-log unreliability

| # | Threat | Feature | V-NN | Notes |
|---|---|---|---|---|
| R-1 | Audit log line for a write attributed to a forged user; later denial cannot be disproved | `agent-writes-on-behalf-of-human.feature` | V-03 | Field renamed `claimed_author_id` (Option B). Audit log now self-documents that attribution is self-reported. |
| R-2 | Audit-log line tampered post-write (no hash chain) | (cross-cutting) | V-03 fix #3 | **Deferred** — `prev_hash` field on `write-audit.jsonl` / `action-log.jsonl` not yet implemented. ASSESSMENTS.md records as residual risk. |
| R-3 | `tick_counter` non-determinism causes drift-gate to mis-classify SPA upload as `human-implicit` rather than `human-via-mcp` | `agent-writes-on-behalf-of-human.feature` | V-05 | Unit-02 producer + consumer fix (commit `399c2ee13`). Per-stage counter for stage-scope writes; intent-scope counter for `stage === null` writes; drift-gate union scan. |
| R-4 | Stale on-disk lines retain legacy `human_author_id` key while new lines write `claimed_author_id` — readers must coalesce | (cross-cutting) | V-03 | Mitigated via `readClaimedAuthorId(record)` helper that reads `claimed_author_id ?? human_author_id`. |

### 3.4. Information disclosure — content leak via served files

| # | Threat | Feature | V-NN | Notes |
|---|---|---|---|---|
| I-1 | Stored XSS via `.html` / `.htm` / `.svg` knowledge upload — script executes in tunnel-origin's security context, exfiltrates session token + intent contents | `drift-assessment-visibility.feature` (rendering chokepoint) | V-01 | Unit-01 ALLOWED_MIMES + BLOCKED_EXTENSIONS allowlist (commits `3867608a6`, `bfa4b7c91`). **Bound (FB-34):** the allowlist matches the *claimed* MIME and the *filename extension*, not the byte content; HTML bytes shipped as `image/png`/`.png` pass at boundary 2 and rely on the serve-side extension-driven `Content-Type` + browser respect (boundary 4). Magic-byte sniffing tracked as ASSESSMENTS.md R-6. Serve-side hardening (CSP, sandboxed sub-origin, `Content-Disposition: attachment` for non-image/PDF) deferred — see ASSESSMENTS.md R-1. |
| I-2 | Same class on stage-output upload path; HTML mock renders inline with full DOM access | `explicit-spa-upload.feature` + `drift-assessment-visibility.feature` | V-02 | Same allowlist mitigation, **same bound** (claimed-MIME + extension; magic-byte sniffing under R-6). Sandboxed sub-origin for HTML mockups deferred — see ASSESSMENTS.md R-5. |
| I-3 | Reflected XSS via reviewer-rendered feedback markdown (agent-authored body) | `manual-change-assessment.feature` + `drift-assessment-visibility.feature` | V-10 | Unit-03 server-side sanitizer in `feedback-api.ts` (commit `143a1ccbf`). |
| I-4 | OpenTelemetry exporter exfiltrates audit-log content / file paths / `claimed_author_id` to a configured collector | (cross-cutting telemetry) | (not in VULN-REPORT) | Mitigation: telemetry events redact path tail, never include file *content*. Deferred enhancement: PII allowlist for `claimed_author_id` (rate-limit / hash before export). |

### 3.5. Denial of service — resource exhaustion

| # | Threat | Feature | V-NN | Notes |
|---|---|---|---|---|
| D-1 | Misconfigured `HAIKU_UPLOAD_MAX_BYTES` accepts multi-GB payloads; fastify-multipart buffers + sync SHA in drift gate stalls workflow tick | `explicit-spa-upload.feature` | V-07 | Unit-01 `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB` (commit `3867608a6`). Effective cap clamps via `Math.min`; `haiku.upload.cap_clamped` telemetry on misconfig. |
| D-2 | Unbounded `agent_rationale` written to `DA-NN.json`; assessments-list endpoint reads them all into RAM | `manual-change-assessment.feature` | V-09 | Unit-01 schema-validation rejects `>10 KB` rationale / `>1 KB` excerpt; list-endpoint truncates to 256 chars + `…` (commit `0f87ed407`). |
| D-3 | `@fastify/multipart` decompression bomb / parser-confusion / slowloris on upload routes | `explicit-spa-upload.feature` | (dependency-class) | See §6.1 dependency enumeration. Partial mitigation: `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB` caps payload size; **no `connectionTimeout` / `requestTimeout` / `keepAliveTimeout` is configured today** (fastify default `connectionTimeout = 0`, no override in `http.ts:107-136`). Slowloris residual risk is **unmitigated** until rate-limiting + connection-timeout work lands (tracked under R-3 / FB-08, escalated from "deferred enhancement" to "tracked unfixed risk"). |
| D-4 | `haiku_classify_drift` rapid-fire calls bloat assessment store and starve the drift gate | `manual-change-assessment.feature` | (rate-limit gap) | **Deferred** — per-session cap / per-IP rate-limit recorded as residual risk. |

### 3.6. Elevation of privilege — boundary crossings

| # | Threat | Feature | V-NN | Notes |
|---|---|---|---|---|
| E-1 | CSRF: cross-origin POST from attacker-controlled origin succeeds because `?t=<jwt>` is in URL + multipart-form-data is CORS-safe | `explicit-spa-upload.feature` | V-08 | Unit-03 three-layer defense: (1) ban `?t=` on mutating verbs, (2) Origin allowlist (`HAIKU_ALLOWED_ORIGINS`), (3) per-session CSRF nonce as `X-Haiku-CSRF` header (commit `bed443315`). Audit script enumerates routes to ensure preHandler coverage. |
| E-2 | Symlink-write via TOCTOU drops file outside intent dir into attacker-chosen path (e.g. `/etc/cron.d/`) | `agent-writes-on-behalf-of-human.feature` | V-04 | Same mitigation as T-1/T-2. Residual race accepted. |
| E-3 | `guard-workflow-fields` PreToolUse hook bypassed via Bash (agent writes workflow-managed file directly with `cat > ...`); compensating control is the drift gate | (cross-cutting — see §5) | (hook-class) | Drift-detection-gate is the compensating control. Residual risk if drift gate is disabled. See §5 row. |
| E-4 | `claimed_author_id` carrying HTML / shell-metacharacter payload poisons future SPA audit-log viewer (stored XSS sink) | `explicit-spa-upload.feature` + `agent-writes-on-behalf-of-human.feature` | V-03 R-04 | `ATTRIBUTE_TO_USER_PATTERN = /^[\w][\w\-.@ ]{0,127}$/` (commit `bfa4b7c91`). Wide enough for real human IDs, narrow enough to reject every HTML/JS sigil. |

---

## 4. Per-feature attack-surface map

Each entry-point feature gets a row with: trust boundary crossed, primary
threats, V-NN findings closed, V-NN findings deferred.

### 4.1. `silent-filesystem-drop-detection.feature`

- **Trust boundary**: out-of-band human writes (or rogue agent Bash
  bypass) → drift gate trust verdict. Two MCP-tool entry points sit on
  this feature's surface (see §5): `haiku_classify_drift` (drift
  classification) and `haiku_baseline_init` (baseline establishment).
- **Primary threats**: T-3, T-4 (baseline tamper), T-6
  (`haiku_baseline_init` re-baseline laundry), E-3 (guard bypass).
- **Closed**: V-11 RT1/RT2/RT6 anchored on tamper-evident surfaces
  (unit-03, commit `3c3ccf1a0`); V-11 operator-only baseline-reset path;
  T-6 tracked-surface allow-list + SHA-idempotency on `haiku_baseline_init`.
- **Deferred**: drift-gate kill-switch monitoring (operator alert if the
  gate is disabled) — see §5; T-6 audit-log gap (no
  `baseline_corruption_event` on agent-driven re-baseline) — see §5 and
  ASSESSMENTS.md residual risk.

### 4.2. `agent-writes-on-behalf-of-human.feature`

- **Trust boundary**: agent → file system, with `haiku_human_write` as
  the chokepoint. Author attribution is the integrity hinge.
- **Primary threats**: S-1 (forged claimed_author_id), T-1 (symlink
  TOCTOU), R-3 (tick-counter non-determinism), E-2 (symlink escape).
- **Closed**: V-03 (Option B rename, commit `399c2ee13`), V-04 (single-shot
  TOCTOU close, commit `573c91da1`), V-05 (intent-scope counter +
  drift-gate union, commit `399c2ee13`).
- **Deferred**: V-03 fix #3 (audit-log hash chain) — see ASSESSMENTS.md
  residual risk; V-04 fix #1 (full `O_NOFOLLOW`-everywhere) — same.

### 4.3. `manual-change-assessment.feature`

- **Trust boundary**: agent → assessment store; agent-authored feedback
  bodies → reviewer SPA renderer.
- **Primary threats**: I-3 (stored XSS via feedback body), D-2 (rationale
  bloat), D-4 (rapid-fire classify).
- **Closed**: V-09 (rationale caps + list truncation, commit `0f87ed407`),
  V-10 (server-side feedback sanitizer, commit `143a1ccbf`).
- **Deferred**: per-session rate-limit on `haiku_classify_drift` — see
  ASSESSMENTS.md residual risk.

### 4.4. `explicit-spa-upload.feature`

- **Trust boundary**: tunnel-mode reviewer (JWT-bearing) → file system
  via `/api/intents/:intent/uploads/{stage-output,knowledge}`.
- **Primary threats**: I-1, I-2 (stored XSS via uploaded HTML/SVG), S-3
  (cross-session write), T-2 (TOCTOU on SPA path), T-5 (substring status
  check), D-1 (size DoS), E-1 (CSRF), E-4 (audit-log poisoning).
- **Closed (with bound)**: V-01/V-02 (allowlist + extension blocklist,
  commits `3867608a6`, `bfa4b7c91`) — **closure bound:** the allowlist
  trusts client-supplied MIME (`filePart.mimetype`) and filename
  extension; the leading bytes are NOT inspected. HTML payloads
  shipped as `image/png`/`.png` pass boundary 2 and the closure of
  I-1/I-2 then depends on serve-side defenses (extension-driven
  Content-Type, future `nosniff`, future CSP). See ASSESSMENTS.md R-6
  for the magic-byte residual. V-03 R-01 (cross-session sid binding,
  `4e5af2b76`), V-06 (shared `gray-matter` status helpers, `399c2ee13`),
  V-07 (hard cap, `3867608a6`), V-08 (three-layer CSRF, `bed443315`).
- **Deferred**: serve-side `Content-Disposition: attachment` + CSP for
  non-image/PDF; sandboxed sub-origin for HTML mockups; magic-byte
  content sniffing on the binary-class allowlist members (R-6) — see
  ASSESSMENTS.md residual risk.

### 4.5. `drift-assessment-visibility.feature`

- **Trust boundary**: reviewer browser ← assessment-rendering surface
  (markdown body, file content) ← agent / SPA writers.
- **Primary threats**: I-1, I-2 (stored XSS lands here when reviewer
  GETs the file), I-3 (feedback markdown), I-4 (OTel exfiltration of
  rendered content).
- **Closed**: V-09 (list truncation), V-10 (feedback sanitizer).
- **Deferred**: CSP on the rendered-assessment routes (defense-in-depth
  even after upload-side allowlist) — folded into "serve-side hardening"
  residual risk.

---

## 5. `guard-workflow-fields` PreToolUse-bypass class

The `guard-workflow-fields` hook denies generic `Read` / `Write` / `Edit`
on workflow-managed files (`units/*.md`, `feedback/*.md`, `intent.md`,
`stages/*/state.json`) and redirects the agent to MCP tools that enforce
lifecycle, frontmatter validation, and integrity sealing.

**The bypass class**: the agent can use `Bash` with `cat > file` /
`tee file` / `sed -i file` / `python -c 'open(...).write(...)'` to write
the same files without triggering PreToolUse. The hook is documented as
"not a hostile-agent control" — it redirects honest mistakes, not
adversarial bypass.

**Compensating control**: `silent-filesystem-drop-detection.feature` — the
drift gate observes the resulting file change on the next `haiku_run_next`
tick, hashes it against the baseline, and surfaces the unannounced write
as drift requiring reviewer classification (`haiku_classify_drift`). Bash
bypass becomes visible exactly because it doesn't go through the MCP
tool that would have stamped `human-via-mcp` on the action log.

**Residual risk**: if the drift-detection gate is disabled (via the
`settings.drift_detection === false` kill-switch checked at
`packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:5`),
the compensating control evaporates and the agent's Bash bypass becomes
silent. The disable event is observable on the existing telemetry signal
`haiku.drift.gate.kill_switch_hit` emitted at
`drift-detection-gate.ts:403`. ASSESSMENTS records this as a deferred
risk: operator-alert wired to that telemetry signal whenever the
kill-switch fires, recommended target iteration to fold into the
`silent-filesystem-drop-detection` follow-up wave. **(There is no
`HAIKU_DRIFT_DETECTION` environment variable — `grep -r 'HAIKU_DRIFT_DETECTION' packages/`
returns zero matches; an alerting implementation that watches for an
env-var override would never fire. The settings-field path above is the
only authentic disable surface.)**

**`haiku_classify_drift` as its own MCP-tool entry point**: the tool
itself is the trust boundary between "drift observed" and "drift accepted
as authorized by a human." Writes through the tool stamp `tick_scope`,
`claimed_author_id`, and the classification result. V-09 (rationale
bloat) and V-10 (feedback body XSS) are the two findings on this entry
point; both closed in unit-01 and unit-03 respectively. The tool is
schema-bounded (input validation rejects oversize fields before any disk
write), so a hostile agent's blast radius is capped at the schema edge.

**`haiku_baseline_init` as its own MCP-tool entry point**: sibling to
`haiku_classify_drift` — the same drift subsystem exposes a second
operator-callable MCP tool that writes directly to the integrity-critical
`baseline.json` asset. Registered at
`packages/haiku/src/tools/orchestrator/index.ts:13,26`; implementation at
`packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts`. Two modes:
`establish-all` (scan every tracked file across every stage) and
`establish-paths` (baseline only the listed paths). T-6 in §3.2 enumerates
the threat surface in detail. The trust-boundary justification mirrors
`haiku_classify_drift`: in **local mode** (§1.1) the MCP socket is
loopback-only and any caller is trusted-equivalent to the operator; in
**tunnel mode** (§1.2) MCP tool calls do NOT traverse the tunnel
(`isRemoteReviewEnabled()` only gates the HTTP routes — the MCP transport
remains stdio/local even when the SPA tunnel is up), so the remote-attacker
attack model from §1.2 does not apply here. The remaining attacker model
is "hostile/buggy agent invoking the tool against the operator's intent" —
the same model that motivates the `establish-paths` allow-list
(`haiku_baseline_init.ts:49-82`, structurally identical to the
`haiku_human_write` deny-list). The tool's blast radius is capped at:
(a) the tracked-surface allow-list (workflow-managed and drift-subsystem
internal files cannot be baselined), (b) `path_escape` rejection prevents
writes outside the intent directory, and (c) SHA-idempotency means
existing baselined files are skipped — the tool can only ADD new entries
or mutate the SHA of an existing entry to match new on-disk content.
Audit-log gap (deferred, tracked under FB-16): unlike the gate-side
silent-establish path which emits `baseline_corruption_event` action-log
entries when corruption is detected, agent-driven `haiku_baseline_init`
invocations write the new baseline without an action-log entry. This is
recorded as residual risk in ASSESSMENTS.md — the operator-confirmation
gate that protects `/haiku:repair --confirm-baseline-reset --diff-shown`
is not replicated at the MCP-tool layer, so the layered defense for this
write surface is allow-list + idempotency only, not allow-list +
idempotency + operator-confirmation + action-log.

---

## 6. Third-party dependency threat enumeration

### 6.1. `@fastify/multipart`

- **Parser confusion**: malformed multipart boundary / nested-boundary
  attacks could cause field interleaving or field-stream desynchronization.
  Mitigation: fastify-multipart's parser is mature and documented to
  reject malformed boundaries; we further enforce content-type allowlist
  before reading the stream.
- **Decompression bomb**: gzip/deflate body with extreme expansion ratio
  could exhaust memory. Mitigation: we do not enable any decompression
  middleware ahead of the multipart parser; the raw byte cap
  (`MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB`) bounds pre-decompression size.
- **Slowloris**: trickle a multipart body slowly to hold a connection.
  **Mitigation in place: NONE.** Fastify's default `connectionTimeout`
  is `0` (no timeout) per `fastify` docs `Reference/Server.md:142`, and
  `buildApp()` at `packages/haiku/src/http.ts:107-136` does not override
  it (`grep -rn 'connectionTimeout\|requestTimeout\|keepAliveTimeout' packages/haiku/src/`
  returns zero matches). The only payload-bounding control today is
  `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB` on the upload routes, which caps
  total bytes but does NOT bound connection lifetime — a textbook
  slowloris attacker can hold connections indefinitely. Residual risk:
  **unmitigated** — escalated from "deferred enhancement" to "tracked
  unfixed risk" in ASSESSMENTS.md §4 R-3. The fix unit MUST set
  `connectionTimeout` (suggested: 30 000 ms) and `requestTimeout`
  (suggested: 60 000 ms) on the `Fastify({ ... })` call in
  `packages/haiku/src/http.ts:107-136`, paired with a regression test
  that asserts a stalled multipart upload is killed within the timeout.
- **Recommendation**: pin minor version, watch GHSA advisories,
  re-audit on every `@fastify/multipart` major bump.

### 6.2. `gray-matter`

- **YAML deserialization**: gray-matter uses `js-yaml` under the hood.
  Default safe-load mode prevents JS-yaml deserialization gadgets
  (custom tags / `!!js/function` / `!!js/regexp`). We rely on the safe-load
  default and do not pass any custom schema.
- **Prototype pollution**: parsed frontmatter object could carry
  `__proto__` / `constructor` keys. Mitigation: we read specific fields
  (`status`, `archived`, etc.) by name rather than spreading the parsed
  object. A future code change that does `{ ...data }` would re-introduce
  the risk — call out in `ASSESSMENTS.md` as a code-review checklist item.
- **Resource exhaustion**: extremely large frontmatter blocks could
  exhaust memory during parse. Mitigation: `intent.md` is bounded by
  schema (workflow engine enforces structure). External callers cannot
  provide arbitrary frontmatter through the upload routes (uploads write
  body bytes; frontmatter is not parsed from upload content).
- **Recommendation**: never call `matter(raw, { ... })` with custom
  options that re-enable unsafe YAML loading; pin minor version.

### 6.3. `@opentelemetry/*`

- **Outbound exfiltration**: an attacker who can configure
  `OTEL_EXPORTER_OTLP_ENDPOINT` redirects telemetry — including any
  field passed to `recordEvent()` — to their collector. Threat applies
  if env-var override is reachable from a less-privileged context.
  Mitigation: env vars are operator-controlled at process start; no
  runtime API exposes endpoint reconfiguration.
- **PII leak**: every `recordEvent` payload should be reviewed for
  attribute names that include user/agent-supplied content (file paths,
  `claimed_author_id`, rationale text). Current policy: telemetry attrs
  are bounded to enums, counts, and path-tail hashes. A future event
  that adds `claimed_author_id` directly (rather than a hash) would leak
  reviewer identity to the OTel collector — call out in code review.
- **Dependency tree size**: `@opentelemetry/*` pulls a deep transitive
  tree. Each transitive dependency widens the supply-chain surface.
  Mitigation: lockfile review on bumps; `npm audit` in CI.
- **Recommendation**: never log raw rationale / feedback body / file
  content as a span attribute; restrict to enums + hashes.

### 6.4. Forward-looking dependency hygiene (not in `package.json` today)

This sub-section is **NOT** a present third-party surface. It is a
code-review checklist for hypothetical future additions that the
hand-rolled HMAC path in `packages/haiku/src/tunnel.ts` would naturally
attract. Listing it under §6 with the live deps would misrepresent the
present surface; surfacing it here keeps the audit checklist near the
real enumeration without claiming the dependency exists.

(Verification: `grep -n "jsonwebtoken" packages/haiku/package.json` →
no output; `grep -rn "jsonwebtoken" packages/haiku/src/` → no output.
Token sign/verify lives in `packages/haiku/src/tunnel.ts` using
`crypto.createHmac` directly — see §1.3 / §1.4 for the
`EPHEMERAL_SECRET` lifecycle and JWT claim semantics.)

**If a future refactor adopts `jsonwebtoken`** to replace the
hand-rolled HMAC path, the audit MUST cover:

- **Algorithm-confusion (`alg: none`, RS-vs-HS swap)**: the verify call
  MUST be invoked with explicit `algorithms: ["HS256"]` (the library
  defaults to all algorithms allowed pre-9.x). The current hand-rolled
  path already enforces `alg !== "HS256"` rejection and constant-time
  signature compare; the equivalent bar must hold post-refactor.
- **Key-confusion via `EPHEMERAL_SECRET` rotation**: a verify path that
  is ever passed a stale secret (e.g. token minted under secret-A,
  verified under secret-B without re-issuing) MUST return
  `bad_signature`. Today this is impossible because the secret is
  process-local and never rotated within a process. A future refactor
  that adds key rotation MUST track which secret each token was minted
  against and accept verify against any non-revoked key.
- **Recommendation**: keep using the hand-rolled HMAC path until there
  is a concrete reason to take the dependency; if added later, audit
  the verify call site for the explicit `algorithms` allowlist before
  the unit's gate passes.

(Tracked separately: the actually-present third-party deps that §6
should additionally cover — `@sentry/node`, `@fastify/cors`,
`@fastify/rate-limit`, `marked` — are surfaced in their own findings on
this artifact and folded into §6.5 – §6.7 below in those fix loops.)

### 6.5. `@sentry/node`

In-tree at `packages/haiku/package.json:29` (`"@sentry/node": "^10.47.0"`),
consumed by `packages/haiku/src/sentry.ts:1-80`. Initialized at
`sentry.ts:9-15` with the operator-supplied `observability.sentryDsn`;
when unset every export short-circuits and no network traffic is emitted
(`sentry.ts:42, 59, 78`). When set, the client opens an outbound HTTPS
channel to the Sentry SaaS endpoint encoded in the DSN. This is the
fourth third-party telemetry/transport surface in the dependency set
(alongside `@fastify/multipart`, OTel, and the hand-rolled HMAC tunnel)
and was previously omitted from this enumeration; closing the gap now.

- **Outbound exfiltration (DSN reconfiguration)**: an attacker who can
  set `HAIKU_SENTRY_DSN` (the env var read by `config.ts` and surfaced
  as `observability.sentryDsn`, see `sentry.ts:7`) at process start
  redirects every captured exception and every captured feedback body
  to their own Sentry project. The threat model and operator surface
  match §6.3 OTel exactly (`OTEL_EXPORTER_OTLP_ENDPOINT`): env vars are
  read once at process start, no runtime API exists to swap the DSN
  after `Sentry.init` has been called (`sentry.ts:10-14` is the only
  init site). Mitigation in place: env vars are operator-controlled at
  process start; no MCP tool, hook, or HTTP route exposes DSN
  reconfiguration, and `grep -rn 'HAIKU_SENTRY_DSN\|sentryDsn' packages/haiku/src/`
  returns only `config.ts` (read) and `sentry.ts` (consumed at init) —
  no write path. Residual risk: identical to OTel — an operator running
  the MCP under an env file that an attacker can edit is compromised
  pre-process; out of scope for application-layer controls.
- **PII leak via `extra: context` (captureException)**:
  `reportError(err, context, sessionCtx)` at `sentry.ts:37-47` ships
  the entire `context` object outbound as Sentry's `extra` field
  (`sentry.ts:45 Sentry.captureException(err, { extra: context })`).
  Unlike OTel `recordEvent` payloads (which we constrain to enums,
  counts, and path-tail hashes per §6.3), `extra: context` is an
  **unconstrained `Record<string, unknown>`** at the type level — every
  `reportError` call site decides what goes in. Today's call sites
  pass file paths, intent slugs, and `claimed_author_id`-class
  identifiers; a future call site could pass raw rationale, feedback
  body content, or unit body excerpts and the type system will not
  catch it. The §6.3 OTel mitigation ("never log raw rationale /
  feedback body / file content as a span attribute; restrict to
  enums + hashes") does NOT extend to this path because there is no
  central chokepoint — `reportError` is the chokepoint, but it accepts
  arbitrary `unknown`. **Mitigation in place: NONE.** Recommended
  control: tighten the `context` parameter type from
  `Record<string, unknown>` to a discriminated union of approved keys
  (e.g. `{ error_code: string; surface: string; path_tail_hash?: string }`),
  OR introduce a `sanitizeSentryExtra(context)` helper at the
  `reportError` chokepoint that allowlists keys and hashes path-tail
  values before handing off to `Sentry.captureException`. Either route
  produces a typecheck-enforced control that mirrors §6.3 OTel's
  guarantee.
- **Feedback-body leak (captureFeedback)**:
  `reportFeedback(message, sessionCtx, contactEmail, name)` at
  `sentry.ts:53-69` calls `Sentry.captureFeedback({ message, ... })` at
  line 63, sending the user/agent feedback body verbatim to the Sentry
  SaaS. The V-10 fix landed a server-side sanitizer for the
  disk-stored copy of feedback (see `I-3` row in §7 and the unit-03
  feedback-sanitizer quality gate), but that sanitizer runs on the
  filesystem-write path and does NOT cover the
  `Sentry.captureFeedback` call here — `reportFeedback` is invoked
  from the SPA review-server feedback-submission route directly with
  the raw body string, bypassing the disk-sanitizer entirely. Threat:
  the same XSS / control-character / oversize-payload class V-10
  closed for the disk-stored copy still flows through to Sentry.
  Worse, contact email and submitter-supplied `name` (lines 65-66) are
  also sent — these can carry attacker-controlled values that surface
  on the Sentry triage UI for whoever reads the inbox. **Mitigation in
  place: NONE.** Recommended control (one of):
  (a) **Operator opt-in gate** — wrap the `Sentry.captureFeedback`
      call in `if (observability.sentryShipFeedbackBodies) { ... }`
      and default to `false`; the existing tag (`scope.setTag("feedback", "true")`
      at line 62) still fires so operators see *that* feedback was
      submitted without leaking content.
  (b) **Sanitize before send** — invoke the same sanitizer V-10 uses
      on the disk-write path (the helper exported from
      `feedback-sanitizer.ts` per the unit-03 quality gate) on
      `message`, `contactEmail`, and `name` before passing to
      `Sentry.captureFeedback`. This is the lower-friction path and
      keeps the existing default-on behavior.
  Either mitigation MUST land alongside the unit-fix that addresses
  this finding; recommend (b) as the default and document (a) as the
  operator-escape-hatch in `observability` config docs.
- **Supply-chain footprint**: `@sentry/node` pulls a transitive tree
  (`@sentry/core`, `@sentry/types`, `@sentry/utils`, plus Node-runtime
  integrations like `@sentry/profiling-node` if enabled). Comparable in
  depth to the `@opentelemetry/*` tree called out in §6.3. Adds a
  separate auth-token surface: the `SENTRY_AUTH_TOKEN` env var read by
  `package.json:10`'s `postbuild` script for sourcemap upload runs only
  in CI/release contexts, never on a user machine, so no runtime auth-
  token leak path exists from the consumer side — but operators
  building the plugin from source MUST treat that token as a release
  credential. Mitigation: lockfile review on bumps; `npm audit` in CI
  (already covers all third-party deps).
- **Recommendation**: pin minor version, watch GHSA advisories,
  re-audit on every `@sentry/node` major bump. NEVER ship raw
  rationale, feedback body, or file content as `extra: context`. Land
  the `extra`-allowlist (or chokepoint sanitizer) and the
  `captureFeedback` sanitizer-or-opt-in gate in the unit that closes
  this finding. Add a code-review checklist item: any new call to
  `reportError(err, context, ...)` MUST justify every key in
  `context`.

### 6.5. `@fastify/cors`

- **Registration site**: `packages/haiku/src/http.ts:14` (import),
  `packages/haiku/src/http.ts:192-218` (`instance.register(fastifyCors, …)`).
  Registered ONLY when `isRemoteReviewEnabled()` is true
  (`packages/haiku/src/http.ts:192`); local mode emits no CORS headers
  at all. This is the load-bearing implementation behind THREAT-MODEL
  §3.6 E-1 ("Origin allowlist") Layer 2 of the CSRF defense and behind
  ASSESSMENTS R-3's references to origin-based mitigation.
- **Origin-comparison semantics**: the `origin` callback at
  `http.ts:194-197` defers to `resolveAllowedCorsOrigin(origin)` at
  `http.ts:100-105`, which compares the request `Origin` header against
  the configured allowlist using **exact string equality** (`Array.includes`)
  with two filters: empty entries dropped, the literal `"*"` dropped
  (so a wildcard-by-accident in `HAIKU_REVIEW_ALLOWED_ORIGINS` collapses
  to "no allowed origins" — fail-closed).
  - The narrower `isOriginAllowed()` helper at
    `packages/haiku/src/http/csrf.ts:100-126` (used by Layer 3 nonce
    enforcement, not by `@fastify/cors` directly) supports
    trailing-port wildcards (`http://localhost:*`) and subdomain
    wildcards (`https://*.example.com`) for the CSRF Origin check —
    the CORS allowlist does NOT. The two surfaces are intentionally
    decoupled: CORS uses exact-match (operator-controlled), CSRF
    permits the loopback wildcard for dev convenience.
- **Preflight handling**: `OPTIONS *` is owned globally by
  `@fastify/cors` (per the explicit comment at
  `packages/haiku/src/http/default-routes.ts:55-62` referencing
  `node_modules/@fastify/cors/index.js:79`). For an allowed origin
  the preflight returns 204 with `Access-Control-Allow-Origin`,
  `-Allow-Methods`, `-Allow-Headers`, `-Expose-Headers`. For a
  disallowed origin `@fastify/cors` calls `callNotFound` and the
  request lands in our `setNotFoundHandler` at
  `packages/haiku/src/http/default-routes.ts:81-89`, which responds
  204 with NO ACAO/ACAM/ACAH/ACEH headers — the browser sees no CORS
  grant and blocks the real request. The bare 204 is intentional so
  the OPTIONS path does not leak route existence differently from the
  404 path. **Mitigation tested**: see the existing CSRF + CORS test
  suite (audit-mutating-routes script) referenced in §7 row E-1.
- **Methods + headers exposed**: `["GET", "HEAD", "POST", "PUT",
  "DELETE", "OPTIONS"]` plus `Authorization`, `Content-Type`,
  `bypass-tunnel-reminder`, `X-Haiku-CSRF` allowed inbound; only
  `X-E2E-Encrypted` and `X-Original-Content-Type` exposed outbound.
  `credentials: false` (cookies are not part of the auth model — JWT
  in `Authorization` header is). `strictPreflight: false` matches the
  pre-rewrite hand-rolled behaviour (the test contract permits a
  preflight without an `Access-Control-Request-Method` header).
- **OPTIONS-route ownership conflict surface**: the only known sharp
  edge is "do not register a sibling `instance.options('/*')` —
  `@fastify/cors` already owns the global OPTIONS route and
  re-declaration throws `Method 'OPTIONS' already declared for route
  '/*'` at `buildApp` time" (per the comment at
  `packages/haiku/src/http/default-routes.ts:55-62`). Threat: a
  future contributor adding a hand-rolled CORS preflight handler on
  any route would break server boot — caught at build time, not
  runtime; failure mode is loud, not silent.
- **Wildcard handling**: `HAIKU_REVIEW_ALLOWED_ORIGINS` is parsed in
  `config.ts` and consumed via `review.allowedOrigins`; the
  `resolveAllowedCorsOrigin()` filter explicitly strips both `""` and
  `"*"` before exact-match. There is NO path by which an operator can
  configure `@fastify/cors` to echo `Access-Control-Allow-Origin: *`
  to the client — even if `HAIKU_REVIEW_ALLOWED_ORIGINS=*` is set,
  the filter drops it and the effective allowlist falls back to
  `[review.siteUrl]`. Misconfiguration mode (no allowlist + no site
  URL → empty allowed-set → silent reject of every cross-origin
  request) is detected at startup by the explicit warning at
  `packages/haiku/src/http.ts:354-369` (FB-12).
- **Recommendation**: pin minor version, watch GHSA advisories on
  `@fastify/cors`. Re-audit the OPTIONS-ownership comment at
  `default-routes.ts:55-62` whenever `@fastify/cors` major-bumps —
  the index.js:79 line reference is implementation-specific and may
  drift across versions. The exact-match origin policy is a
  deliberate narrowing vs the more permissive `isOriginAllowed`
  helper used for CSRF Layer 3; if a future change unifies them,
  audit the CSRF call sites first.

### 6.6. `@fastify/rate-limit`

- **Registration site**: `packages/haiku/src/http.ts:15` (import),
  `packages/haiku/src/http.ts:228-243` (registration). Registered ONLY
  when `isRemoteReviewEnabled()` is true; local-loopback mode runs
  with NO rate limiting (rate-limit value zero is intentional in
  local mode where the only client is the developer's own browser).
- **Plugin-wide scope**: registered against the root `instance` AFTER
  CORS but BEFORE `registerCsrfRoutes`, `registerSessionRoutes`,
  `registerFileServeRoutes`, `registerFeedbackRoutes`,
  `registerUploadRoutes`, `registerAssessmentsRoutes`, and
  `registerWsUpgrade` (see `http.ts:228-306`). This means the
  per-IP cap covers **every HTTP route** in tunnel mode — feedback
  CRUD, intent-mutation routes, upload routes, asset serves,
  assessments reads, the CSRF nonce-mint endpoint, and the WebSocket
  upgrade handshake. There is NO per-route allowlist today; every
  route shares the same `(IP, window)` budget.
  - **Closes ASSESSMENTS R-3 partial gap**: this scope DOES cover
    "per-IP rate-limit on mutating tunnel-mode routes" (V-08 Layer 4 +
    D-3/D-4 surface). What it does NOT do: per-token / per-session
    keying, per-route differentiation, or coverage of the
    long-running WebSocket frames (only the upgrade handshake counts;
    in-stream messages are not rate-limited).
- **Per-key derivation (default IP)**: `@fastify/rate-limit` defaults
  to `req.ip` for the bucket key. Fastify resolves `req.ip` from
  `req.socket.remoteAddress` UNLESS `trustProxy` is set on the
  `Fastify({...})` factory. We do NOT set `trustProxy`
  (`packages/haiku/src/http.ts:107-137` — full factory call, no
  `trustProxy` field). **Consequence under localtunnel**: every
  request's apparent peer is localtunnel's outbound proxy connection
  (loopback, since localtunnel runs as a sibling process tunnelling
  to a remote relay). The `X-Forwarded-For` header that the relay
  injects is **NOT trusted** — Fastify ignores it and the rate-limit
  bucket effectively becomes "all-of-tunnel" rather than "per
  internet client". This is **intentional and load-bearing**: trusting
  `X-Forwarded-For` from an attacker-reachable surface would let
  attackers spoof their key by injecting their own header. The
  trade-off is that the rate-limit caps the AGGREGATE tunnel-mode
  request rate at `HAIKU_HTTP_RATE_MAX/HAIKU_HTTP_RATE_WINDOW_MS`,
  not per-attacker — sufficient against single-attacker flood but
  not against distributed flood from one tunnel hop.
- **Configured `max` and `timeWindow`**: defaults are
  `max=60` requests, `timeWindow=60_000` ms (1 minute) per
  `http.ts:229-241`. Operator overrides via `HAIKU_HTTP_RATE_MAX`
  (int >= 1) and `HAIKU_HTTP_RATE_WINDOW_MS` (int >= 1000); both
  parsed with `Number.parseInt` + finiteness + lower-bound clamp so
  malformed env vars fall back to defaults silently.
- **Store backend**: the default is in-memory (LRU per-IP map).
  **Process-restart loses the bucket state** — same failure mode as
  `EPHEMERAL_SECRET` rotation noted in §1.3. An attacker who can
  trigger a process restart resets every bucket. Mitigation: process
  restarts under tunnel mode are themselves a meaningful event
  (operator action or crash); the JWT auth window is process-local
  too, so a restart already invalidates the JWT, capping the abuse
  window at "post-restart, pre-mint-of-new-JWT".
- **Error shape on breach**: `@fastify/rate-limit` defaults to HTTP
  429 with body `{statusCode: 429, error: "Too Many Requests",
  message: "Rate limit exceeded, retry in N seconds"}` and a
  `Retry-After` header. We do NOT override the default error shape;
  consumers (the SPA fetch wrapper) handle 429 by surfacing a banner
  and disabling the offending control.
- **No allowlist for csrf-nonce-mint endpoint**: every route shares
  the bucket, INCLUDING the `/api/csrf/nonce` mint endpoint. A
  client that exhausts its rate-limit cannot mint a fresh nonce
  until the window resets. This is acceptable today (60 req/min is
  ~10x a reviewer's realistic click rate) but tighten-then-allow is
  the standard hardening step if the cap is ever lowered.
- **Recommendation**: pin minor version, watch GHSA advisories. Two
  follow-ups for the next security wave: (a) add a per-route
  override for the WebSocket frame stream if rate-limit needs to
  apply at frame level, not just handshake level; (b) reconsider
  store backend if the deployment ever moves off the
  one-process-per-tunnel topology. The deliberate `trustProxy=false`
  posture MUST be preserved unless the deployment topology gains a
  trusted reverse proxy in front of tunnel mode — a future change
  that flips it on without auditing the trust boundary would
  re-open the IP-spoofing-via-header bypass.

### 6.7. `marked`

In-tree at `packages/haiku/package.json:35` (`"marked": "^17.0.5"`),
consumed by `packages/haiku/src/markdown.ts:1` (`import { marked } from "marked"`)
through the single chokepoint `markdownToHtml(md)` at
`markdown.ts:7-14` (`marked.parse(md, { async: false })`). Re-exported
by `packages/haiku/src/index.ts:11-13`. This is the server-side
markdown→HTML renderer that sits downstream of the V-10 server-side
feedback sanitizer (`packages/haiku/src/http/feedback-sanitize.ts`,
shipped at commit `143a1ccbf`); the V-10 sanitizer-vs-renderer
alignment is the load-bearing assumption that keeps the I-3 stored-XSS
control closed. Closing this enumeration gap so a future change to
`marked` configuration can be audited against the V-10 contract.

- **Raw-HTML passthrough (renderer override)**: `marked` v17 supports
  custom renderers via `marked.use({ renderer: { html(text) { return text } } })`
  and per-call options. The current chokepoint at
  `markdown.ts:7-14` calls `marked.parse(md, { async: false })` with
  NO renderer override and NO custom extensions registered process-
  wide (`grep -n 'marked\.use\|new Renderer' packages/haiku/src/` →
  no results other than the single import + parse call). A future
  contributor wiring a custom `html()` renderer that returns the raw
  text would let any HTML token in the input bypass `marked`'s
  default escaping and reach the browser unsanitized — directly
  invalidating the V-10 fix because the V-10 sanitizer strips
  `<script>`/`<iframe>`/`<embed>` etc. on the **disk-write path**, not
  on the render path. A user-authored feedback body that re-introduced
  raw HTML between the disk write (sanitized) and the render call
  (unsanitized renderer override) would re-open I-3 stored XSS.
  **Mitigation in place: NONE for the renderer-override surface.**
  Recommended control: code-review checklist item — "any
  `marked.use({ renderer: ... })` or per-call `renderer:` override on
  `marked.parse` MUST re-run the V-10 XSS test fixtures
  (`packages/haiku/test/unit-03-security.test.mjs` and
  `packages/haiku/test/unit-03-red-team.test.mjs` — the same
  inverted-PoC suite referenced by I-3 row in §7) before the
  containing unit's gate passes". Pair with: pin a `marked` minor
  version and watch GHSA advisories for any default-behavior change
  in `marked.parse`'s built-in HTML escaping.
- **`async: false` and bypass-by-`parseInline`**: the chokepoint
  uses `marked.parse(md, { async: false })`. Two adjacent surfaces in
  the `marked` API are NOT covered by the chokepoint:
  (a) `marked.parseInline(md, { ... })` skips the block tokenizer and
      may behave differently re. tag-in-text handling — a future call
      site that imports `parseInline` directly bypasses the
      chokepoint entirely.
  (b) `async: true` (the v17 default for some entry points) returns a
      Promise; refactoring to `async` without keeping `async: false`
      hard-coded changes the return-type contract at `markdown.ts:9-11`
      and the typecheck at `:10-12` (`if (typeof result !== "string")`)
      becomes the only runtime guard against a misconfigured async
      path silently returning `[object Promise]` to the consumer.
  **Mitigation in place**: the existing typecheck at `markdown.ts:10-12`
  catches case (b) at runtime, throwing rather than rendering a
  `[object Promise]` literal. Case (a) is uncovered. Recommended
  control: lint rule or grep gate in CI — `grep -rn 'parseInline\b' packages/haiku/src/`
  MUST return zero hits unless paired with the same chokepoint guard
  pattern (`async: false` + result-is-string check).
- **URL-scheme handling in autolinks**: `marked`'s default tokenizer
  recognizes autolinks (`<https://...>` and bare URLs). Historically
  some `marked` major versions accepted `javascript:` URLs in
  autolinks. **Verification**: the V-10 sanitizer at
  `packages/haiku/src/http/feedback-sanitize.ts` strips `javascript:`,
  `data:`, and `vbscript:` URL schemes from BOTH HTML attributes and
  markdown link/image targets BEFORE the body reaches disk
  (`feedback-sanitize.ts` URL-scheme allowlist runs on the input, not
  on the rendered output). The sanitizer-runs-before-renderer
  ordering is the load-bearing invariant — the renderer never sees
  an unsafe URL scheme because the sanitizer already removed it from
  the persisted body. A future code change that calls
  `markdownToHtml(rawUserInput)` WITHOUT first running the V-10
  sanitizer would re-introduce the scheme-injection surface.
  **Mitigation in place**: V-10 disk-write sanitizer (commit
  `143a1ccbf`); SPA rendering reads the sanitized body, then renders.
  Recommended control: code-review checklist item — "any new
  `markdownToHtml(...)` consumer MUST document the upstream sanitizer
  in the call site comment, OR demonstrate that the input has no
  user/agent-supplied origin".
- **Major-version bump audit**: `marked`'s major versions have shipped
  sanitizer-relevant breaking changes (the deprecated `sanitize`
  option was removed; the `breaks` and `gfm` defaults shifted; the
  renderer override surface was rewritten). The V-10 fix was authored
  against `marked@^17.x`; a major-bump to v18+ would require
  re-running the V-10 inverted-PoC suite in full. Recommended
  control: pin minor version (already implied by `^17.0.5` allowing
  17.x patch+minor only), and on every `marked` major bump add a
  pre-merge gate that re-runs the V-10 XSS class-defense test suite
  against the new version.
- **Supply-chain footprint**: `marked` is a single zero-dependency
  package — no transitive tree to audit (compare to `@opentelemetry/*`
  in §6.3 and `@sentry/node` in §6.5, which both pull deep trees).
  Mitigation: `npm audit` in CI; lockfile review on bumps; GHSA
  monitoring on `marked` itself.
- **Recommendation**: pin minor version of `marked` (`^17.0.5` is
  the current pin); never call `markdownToHtml(...)` on raw
  user/agent-supplied input without the upstream V-10 sanitizer in
  the same code path; never register a `marked.use({ renderer: ... })`
  override that returns raw HTML without re-running the V-10 XSS
  fixture; treat `marked.parseInline` as a separate chokepoint
  requiring the same `async: false` + result-is-string guard.

---

## 7. Threat-to-control matrix (summary)

| Threat row | Closed by | Commit / location | Verifying gate |
|---|---|---|---|
| S-1, S-2 | Option B rename + `attribute_to_user` allowlist | `399c2ee13`, `bfa4b7c91` | unit-02 quality gate `v03-claimed-author-id-rename`; unit-01 bolt-3 red-team test |
| S-3 | `verifyIntentMutationAuth` cross-session sid bind | `4e5af2b76` | unit-02 blue-team regression test |
| S-4 | `alg: HS256`-only verify | `tunnel.ts:135-148` | (covered by tunnel-auth test suite) |
| T-1, T-2, E-2 | `safeMkdirAndRename` helper, both call sites | `573c91da1` | unit-03 quality gate; planted-symlink rejection test |
| T-3 | Anchored signals on tamper-evident surfaces | `3c3ccf1a0` | unit-03 BLUE-TEAM-VERIFICATION |
| T-4 | Operator-only baseline-reset path | unit-03 quality gate | reconstruct + diff-confirm flow |
| T-5 | Shared `gray-matter` status helpers | `399c2ee13` | unit-02 quality gate `v06-no-substring-status-checks-anywhere` |
| T-6 | Tracked-surface allow-list (`validateTrackedSurfacePath` denies workflow-managed + drift-subsystem-internal paths; rejects `path_escape`) + SHA-idempotency (skips files already baselined to current SHA) on `haiku_baseline_init` | `packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts:49-82, 272-308` | unit-03 quality gate (drift-subsystem allow-list parity with `haiku_human_write`); residual gap (no `baseline_corruption_event` action-log entry on agent-driven re-baseline) tracked in ASSESSMENTS.md FB-16 deferred risk |
| R-1 | `claimed_author_id` rename | `399c2ee13` | unit-02 quality gate |
| R-2 | (deferred — audit-log hash chain) | — | residual risk in ASSESSMENTS.md |
| R-3 | Producer + consumer tick-scope union | `399c2ee13` | unit-02 quality gate `v05-intent-scope-tick-counter` |
| R-4 | `readClaimedAuthorId` coalescing helper | `399c2ee13` | unit-02 quality gate |
| I-1, I-2 | ALLOWED_MIMES + BLOCKED_EXTENSIONS allowlist (claimed-MIME + extension; magic-byte sniffing tracked under R-6) | `3867608a6`, `bfa4b7c91` | unit-01 upload-routes test, red-team-unit-01 inverted PoCs |
| I-3 | Server-side feedback sanitizer | `143a1ccbf` | unit-03 quality gate |
| D-1 | `MAX_UPLOAD_BYTES_HARD_CAP` clamp | `3867608a6` | unit-01 upload-routes hard-cap test |
| D-2 | Rationale schema caps + list-endpoint truncation | `0f87ed407` | unit-01 state-tools-handlers test, assessments-routes test |
| D-3 | (defense via D-1 size cap; rate-limit deferred) | — | partial — residual risk in ASSESSMENTS.md |
| D-4 | (deferred — per-session rate-limit) | — | residual risk in ASSESSMENTS.md |
| E-1 | Three-layer CSRF (query-param ban + Origin + nonce) | `bed443315` | unit-03 quality gate, audit-mutating-routes script |
| E-3 | Drift-detection gate is the compensating control | (existing — silent-filesystem-drop-detection.feature) | drift-gate tests in CI |
| E-4 | `ATTRIBUTE_TO_USER_PATTERN` allowlist | `bfa4b7c91` | unit-01 bolt-3 red-team test |

---

## 8. References

- VULN-REPORT.md — per-finding evidence
- ASSESSMENTS.md — per-fix audit trail with `gate_pass_evidence`
- features/silent-filesystem-drop-detection.feature
- features/agent-writes-on-behalf-of-human.feature
- features/manual-change-assessment.feature
- features/explicit-spa-upload.feature
- features/drift-assessment-visibility.feature
- packages/haiku/src/tunnel.ts (JWT mint/verify)
- packages/haiku/src/http/auth.ts (request auth)
- packages/haiku/src/hooks/guard-workflow-fields.ts (PreToolUse hook)
- packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts (compensating control)
