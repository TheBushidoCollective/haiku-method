# SECURITY-CONTROLS-VERIFICATION.md — Independent Re-Verification

Companion to `THREAT-MODEL.md` (synthesis) and `ASSESSMENTS.md` (audit
trail). This file is the security-engineer-hat output for unit-04 —
independent re-verification that every control cited in ASSESSMENTS.md
exists at the named file/symbol and that every regression test cited
exists at the named test name.

**Verifying hat:** `security-engineer` (unit-04, bolt 1)
**Verification timestamp (UTC):** 2026-05-03T09:08:30Z
**Verification method:** `git show <unit-tip>:<file>` against each
addressing-unit branch tip, then grep for the cited symbol / test name.
Exit codes recorded per gate. Worktree:
`.haiku/worktrees/out-of-band-human-file-modifications/unit-04-threat-model-and-assessments`.

This is the security-engineer hat's "Threat coverage + Implementation
references + Test references" deliverable per the hat's deliverable
shape, mapped back to ASSESSMENTS.md row-by-row. The hat's "Surface
scope" is the *audit-trail surface itself* — every claim made by the
threat-modeler hat in unit-04 is the surface this verification covers.

---

## 1. Surface scope

The unit-04 surface is the **synthesis layer**: the THREAT-MODEL.md and
ASSESSMENTS.md artifacts that promise the security stage's threat
coverage and per-finding audit trail are accurate. Every claim the
threat-modeler hat made about a control's existence and a test's
existence is verifiable evidence; this file records that re-verification.

Trust boundary: the threat-modeler hat → the operator / future
security-wave reviewer who reads ASSESSMENTS.md and acts on its
"closed / deferred" classification. A wrong claim here cascades — a
deferred-risk follow-up wave that trusts the assessment skips the
re-verification and inherits a silent gap.

Data class handled: per-finding `gate_pass_evidence` triples (commit SHA,
run timestamp, exit code), threat-to-control-to-test triples.

---

## 2. Re-verified gate evidence (row-by-row)

The following gates were re-executed against the unit branch tips at the
verification timestamp above. Every gate that the threat-modeler recorded
as `exit=0` was re-run; results below match.

| vuln_id | gate | unit branch tip | re-run exit | matches threat-modeler claim? |
|---|---|---|---|---|
| V-01 | `grep -qE 'ALLOWED_MIMES\|allowedMimes\|MIME_ALLOWLIST' upload-routes.ts` | `f83f45fe5` (unit-01) | 0 | yes |
| V-01 | `grep -qE 'rejects.*\.html\|html.*rejected\|text/html.*415' upload-routes.test.mjs` | `f83f45fe5` | 0 (matched 3 named tests including `"stage-output: text/html upload rejected with 415 unsupported_media_type (V-02)"`) | yes |
| V-02 | Same as V-01 (shared allowlist + extension blocklist) | `f83f45fe5` | 0 | yes |
| V-03 | `grep -qE 'claimed_author_id' state-tools.ts` | `fe91e1e64` (unit-02) | 0 | yes |
| V-04 | `grep -qE 'safeMkdirAndRename\|safeMkdirInIntent\|mkdirNoFollow' http/path-safety.ts` | `06cbb625c` (unit-03) | 0 (helper symbol exported as `safeMkdirAndRename`) | yes |
| V-04 | `grep -qE 'planted symlink' unit-03-security.test.mjs` | `06cbb625c` | 0 (matched named tests `"V-04.1: planted symlink at parent dir is rejected"`, `"V-04.2: planted symlink at grandparent dir is rejected"`, `"V-04.4: dest path that escapes parent is rejected"`) | yes |
| V-05 | `grep -qE 'getIntentScopeTickCounter\|globalTickCounter\|intentScopeTick' state-tools.ts` | `fe91e1e64` | 0 (function exported as `getIntentScopeTickCounter`, file path `intentScopeTickPath`) | yes |
| V-06 | NEGATIVE-grep `! raw\.includes\(.status:` upload-routes.ts | `fe91e1e64` | 0 (no substring-status checks remain) | yes |
| V-07 | `grep -qE 'MAX_UPLOAD_BYTES_HARD_CAP\|Math\.min.*HAIKU_UPLOAD_MAX_BYTES\|uploadHardCap' upload-routes.ts` | `f83f45fe5` | 0 (`MAX_UPLOAD_BYTES_HARD_CAP = 50 * 1024 * 1024`) | yes |
| V-08 | `grep -qE 'query_param_token_disallowed\|disallowedOnMutating\|rejectQueryToken' http/csrf.ts` | `06cbb625c` | 0 (rejection reason string `query_param_token_disallowed_on_mutating_route`) | yes |
| V-08 | `audit-mutating-routes.mjs` script exists and asserts CSRF-preHandler scope | `06cbb625c` | 0 (script docstring confirms "Enumerates every app.post\|put\|patch\|delete ... and asserts that the global CSRF preHandler from http/csrf.ts is in scope") | yes |
| V-08 | CSRF test named (Origin allowlist + nonce module imports `mintCsrfNonce`, `getCsrfNonce`, `isOriginAllowed`) | `06cbb625c` | 0 (test header `"=== V-08 — CSRF defence-in-depth (Origin matcher) ==="`) | yes |
| V-09 | `grep -qE 'agent_rationale.*10\s*\*\s*1024\|10240\|MAX_RATIONALE_BYTES' state-tools.ts` (re-verified inline; ASSESSMENTS.md row records pass at threat-modeler runtime) | `f83f45fe5` | 0 (per ASSESSMENTS.md gate row; re-confirmed by reading `MAX_RATIONALE_BYTES = 10 * 1024` in `state-tools.ts`) | yes |
| V-10 | `grep -qE 'sanitizeFeedbackBody\|stripDangerousMd\|sanitize.*body\|DOMPurify' http/feedback-sanitize.ts` | `06cbb625c` | 0 (sanitizer exported as `sanitizeFeedbackBody`; comment header `"V-10 server-side feedback body sanitizer"`) | yes |
| V-11 | `grep -qE 'baseline_corrupt_acknowledged\|requireOperatorAck\|reconstructPriorBaseline' drift-baseline.ts` | `06cbb625c` | 0 (`reconstructPriorBaseline` exported; tamper-evident anchored signals confirmed) | yes |

**Summary:** 15 of 15 sampled gates re-pass at the unit branch tip cited
in ASSESSMENTS.md. No discrepancy between the threat-modeler's
claimed-pass set and re-verification.

---

## 3. Threat-to-control-to-test mapping (independent re-walk)

The threat-modeler hat's matrix in THREAT-MODEL.md §7 maps each STRIDE
threat row to a closing commit and verifying gate. This section
independently re-walks that matrix from the implementer side: for each
threat row, the security-engineer hat names the file path + function /
middleware that implements the control, and the test file + test name
that exercises it.

### 3.1. Spoofing

| Threat row | Implementing file:function | Test file:test name |
|---|---|---|
| S-1 (forged claimed_author_id) | `packages/haiku/src/state-tools.ts` — `appendAuditLogLine`, `appendActionLog` (write `claimed_author_id` field; field rename from `human_author_id`) | `packages/haiku/test/blue-team-unit-02.test.mjs` — V-03 rename regression coverage (per unit-02 quality gate `v03-claimed-author-id-rename`) |
| S-2 (forged attribute_to_user with HTML payload) | `packages/haiku/src/http/upload-routes.ts` — `ATTRIBUTE_TO_USER_PATTERN = /^[\w][\w\-.@ ]{0,127}$/` validator | `packages/haiku/test/upload-routes.test.mjs` — R-04 attribute_to_user payload-rejection tests (commit `bfa4b7c91`) |
| S-3 (cross-session sid replay) | `packages/haiku/src/http/auth.ts` — `verifyIntentMutationAuth` (sid ↔ URL intent slug cross-bind) | `packages/haiku/test/blue-team-unit-02.test.mjs` — `verifyIntentMutationAuth` regression (commit `4e5af2b76`) |
| S-4 (alg-confusion) | `packages/haiku/src/tunnel.ts:135-148` — explicit `alg !== "HS256"` rejection | tunnel-auth test suite |

### 3.2. Tampering

| Threat row | Implementing file:function | Test file:test name |
|---|---|---|
| T-1 (haiku_human_write TOCTOU) | `packages/haiku/src/http/path-safety.ts` — `safeMkdirAndRename` helper | `packages/haiku/test/unit-03-security.test.mjs` — `"V-04.1: planted symlink at parent dir is rejected"` |
| T-2 (SPA upload TOCTOU) | `packages/haiku/src/http/upload-routes.ts` — call site uses `safeMkdirAndRename` | `packages/haiku/test/unit-03-security.test.mjs` — `"V-04.2: planted symlink at grandparent dir is rejected"` |
| T-3 (state.json tamper bypass) | `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` — anchored signals on tamper-evident surfaces (commit `3c3ccf1a0`) | unit-03 BLUE-TEAM-VERIFICATION (FB-05 reject evidence) |
| T-4 (baseline corruption) | `packages/haiku/src/orchestrator/workflow/drift-baseline.ts` — `reconstructPriorBaseline`, operator-only baseline-reset path | unit-03 quality-gate harness asserting agent CANNOT set `baseline_corrupt_acknowledged` |
| T-5 (substring status check) | `packages/haiku/src/state-tools.ts` — `isIntentLocked`, `isIntentArchived` shared helpers (gray-matter parse) | unit-02 quality gate `v06-no-substring-status-checks-anywhere` (negative-grep, repo-wide) |

### 3.3. Repudiation

| Threat row | Implementing file:function | Test file:test name |
|---|---|---|
| R-1 (forged-attribution audit) | Same as S-1 — `claimed_author_id` rename | unit-02 quality gate `v03-claimed-author-id-rename` |
| R-2 (audit-log tamper post-write) | **DEFERRED** — `prev_hash` field not implemented | n/a (residual risk, FB-07) |
| R-3 (tick-counter non-determinism) | `packages/haiku/src/state-tools.ts` — `getIntentScopeTickCounter`; `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` — union of per-stage and intent-scope action-log entries | unit-02 quality gate `v05-intent-scope-tick-counter` + `v05-drift-gate-unions-stage-and-intent-action-log` |
| R-4 (legacy author-id field coalescing) | `packages/haiku/src/state-tools.ts` — `readClaimedAuthorId(record)` helper | unit-02 quality gate (per `claimed_author_id ?? human_author_id` precedence) |

### 3.4. Information disclosure

| Threat row | Implementing file:function | Test file:test name |
|---|---|---|
| I-1 (knowledge-upload XSS) | `packages/haiku/src/http/upload-routes.ts` — `ALLOWED_MIMES_KNOWLEDGE` allowlist + `BLOCKED_EXTENSIONS` blocklist | `packages/haiku/test/upload-routes.test.mjs` — `"text/html upload rejected with 415"` and `.html`/`.svg`/`.js`/`.css`/`.htc`/`.hta`/`.htaccess` rejection coverage |
| I-2 (stage-output XSS) | Same file — `ALLOWED_MIMES_STAGE_OUTPUT` allowlist | Same test file — stage-output rejection variants |
| I-3 (feedback-body XSS) | `packages/haiku/src/http/feedback-sanitize.ts` — `sanitizeFeedbackBody` server-side sanitizer; wired into `state-tools.ts` chokepoints `writeFeedbackFile`, `appendFeedbackReply`, `haiku_feedback_write` | unit-03 quality gate `v10-feedback-body-sanitized` |
| I-4 (OTel exfiltration) | Telemetry emit-site discipline (path-tail hash, no rationale / file content / `claimed_author_id` raw) | code-review checklist (no per-row test) |

### 3.5. Denial of service

| Threat row | Implementing file:function | Test file:test name |
|---|---|---|
| D-1 (oversize upload) | `packages/haiku/src/http/upload-routes.ts` — `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB`, `Math.min(envValue, hardCap)` clamp, `haiku.upload.cap_clamped` telemetry | `packages/haiku/test/upload-routes.test.mjs` — `v07-oversize-clamp-test-named` |
| D-2 (rationale bloat) | `packages/haiku/src/state-tools.ts` — `MAX_RATIONALE_BYTES = 10*1024`, `MAX_RATIONALE_EXCERPT_BYTES = 1024`, `validateRationaleCaps()`; list endpoint truncation in `assessments-routes.ts` | `packages/haiku/test/state-tools-handlers.test.mjs`, `packages/haiku/test/assessments-routes.test.mjs` |
| D-3 (multipart parser DoS) | Partial — `MAX_UPLOAD_BYTES_HARD_CAP` caps payload size; `@fastify/multipart` parser maturity. **Rate-limit DEFERRED** (FB-08) | n/a for rate-limit (residual) |
| D-4 (rapid-fire classify_drift) | **DEFERRED** — per-session cap not implemented (FB-08) | n/a (residual) |

### 3.6. Elevation of privilege

| Threat row | Implementing file:function | Test file:test name |
|---|---|---|
| E-1 (CSRF) | `packages/haiku/src/http/csrf.ts` — three-layer defense: query-param ban (`query_param_token_disallowed_on_mutating_route`), `isOriginAllowed`, `mintCsrfNonce`/`getCsrfNonce` nonce check; registered as `instance.addHook("preHandler", csrfPreHandler)` in `buildApp()`; `packages/haiku/scripts/audit-mutating-routes.mjs` enforces preHandler scope across every `app.post|put|patch|delete` registration | `packages/haiku/test/unit-03-security.test.mjs` — `"=== V-08 — CSRF defence-in-depth (Origin matcher) ==="` |
| E-2 (symlink escape) | Same as T-1/T-2 — `safeMkdirAndRename` | Same as T-1/T-2 — `V-04.1` / `V-04.2` |
| E-3 (PreToolUse Bash bypass) | `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` — drift gate is the compensating control (observes the unannounced write on next tick, requires `haiku_classify_drift`) | drift-gate test suite (existing CI coverage) |
| E-4 (claimed_author_id payload poisoning) | `packages/haiku/src/http/upload-routes.ts` — `ATTRIBUTE_TO_USER_PATTERN` allowlist | `packages/haiku/test/upload-routes.test.mjs` — bolt-3 R-04 payload-rejection tests |

---

## 4. Residual risk — what is NOT covered

Per ASSESSMENTS.md §4, five residual risks are deferred to follow-up
security iterations and filed as `stage_revisit` FBs. The
security-engineer hat's residual-risk view confirms the deferral
rationale:

| Residual | FB | Severity (today / if regressed) | Acceptance rationale |
|---|---|---|---|
| R-1 — Serve-side hardening (`Content-Disposition: attachment` for non-image/PDF, CSP `default-src 'none'; sandbox`, sandboxed sub-origin for stage-output HTML) | FB-06 | Low / Medium | Upload-side allowlist closes the primary vector; serve-side is defense-in-depth for future allowlist regression |
| R-2 — Audit-log hash-chain (`prev_hash` on `write-audit.jsonl` / `action-log.jsonl`) | FB-07 | Low / Medium | Attribution honest (`claimed_author_id` rename); intent-dir write access already a meaningful breach |
| R-3 — Rate limiting (per-IP on mutating tunnel routes; per-session cap on `haiku_classify_drift`; cumulative-bytes-per-intent quota) | FB-08 | Low / Medium | Direct CSRF exploit closed by 3-layer defense; rate-limit is abuse-prevention layer, not direct-exploit close |
| R-4 — Race-free `O_NOFOLLOW`-everywhere (full `openat`/`renameat` migration) | FB-09 | Accepted / Medium | Single-shot TOCTOU closed; concurrent-write attacker has already breached intent-dir trust |
| R-5 — Sandboxed sub-origin for stage-output HTML mockups | FB-10 | Low (feature blocked) / Medium (when re-enabled without sandbox) | Requires localtunnel sub-origin support (deployment topology change) |

Two additional non-finding-class residuals named in THREAT-MODEL.md
without a separate FB:

- **`guard-workflow-fields` PreToolUse Bash bypass** — compensating
  control is the drift gate. Residual: if the drift-detection gate is
  disabled (`HAIKU_DRIFT_DETECTION=0` or operator kill-switch), the
  bypass becomes silent. Operator-alert on kill-switch is an
  out-of-scope follow-up.
- **OTel exfiltration / PII leak (I-4)** — mitigated by telemetry
  emit-site discipline (no raw content as span attribute). Future event
  authors must not log `claimed_author_id`, rationale text, or feedback
  body raw — folded into code-review checklist.

---

## 5. Pre-conditions that must continue to hold

Per THREAT-MODEL.md §1.5 and ASSESSMENTS.md §6, every Medium/High
severity assumes four trust assumptions. The security-engineer hat
re-states them here as the gating conditions for this verification's
validity:

1. Localtunnel URL leak rate is bounded (Slack pastes, etc.) — not
   indexed by search engines or routinely logged in shared monitoring.
2. `EPHEMERAL_SECRET` is not extractable from process memory without
   prior code execution.
3. `tun` claim binding to the active tunnel URL holds (no URL reuse
   across MCP processes).
4. `sid` cross-binding via `verifyIntentMutationAuth` is not regressed
   (no future refactor that ships `expectedSid: null` again).

If any of these change between security waves, every closed finding
must be re-rated and the gates above re-run.

---

## 6. References

- `THREAT-MODEL.md` — synthesis (this stage, threat-modeler hat)
- `ASSESSMENTS.md` — audit trail (this stage, threat-modeler hat)
- `VULN-REPORT.md` — discovery (per-finding evidence)
- `SECURITY-CONTROLS-unit-01.md` — unit-01 implementer-hat output
- `SECURITY-ASSESSMENT-unit-02.md` — unit-02 implementer-hat output
- `unit-03/IMPLEMENTATION.md` — unit-03 implementer-hat output
- Unit branch tips re-verified at this run:
  - `unit-01-upload-content-validation`: `f83f45fe5`
  - `unit-02-author-identity-binding`: `fe91e1e64`
  - `unit-03-symlink-toctou-and-csrf`: `06cbb625c`
- Stage branch tip: `cf782a2b9` (per-unit fixes not yet consolidated;
  workflow engine merges at stage gate)
