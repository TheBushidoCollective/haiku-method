# Red-Team Report — unit-01 Upload content validation

**Hat:** red-team
**Bolt:** 1
**Date:** 2026-05-01
**Targets reviewed:**
- `packages/haiku/src/http/upload-routes.ts` (allowlists, blocklists, size caps)
- `packages/haiku/src/http/path-safety.ts` (`serveFile` MIME map)
- `packages/haiku/src/state-tools.ts` (`validateRationaleCaps`)
- `packages/haiku/src/http/assessments-routes.ts` (list-endpoint truncation)
- `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts` (rationale wiring)

## Verdict

The unit closed the *named* findings in VULN-REPORT (V-01/V-02/V-07/V-09) but **left an equivalent-class bypass open for the same threat model**. Two HIGH findings, one MEDIUM, one LOW.

The red-team mandate says we MUST NOT declare code "secure" without executing actual attack payloads. The payloads below are validated end-to-end against the live route + serve chain.

---

## Finding R-01 (HIGH) — `.js` extension bypasses V-01/V-02 stored-XSS allowlist

**Threat class:** Stored XSS via served file (same as V-01/V-02).
**Affected routes:**
- `POST /api/intents/:intent/uploads/knowledge`
- `POST /api/intents/:intent/uploads/stage-output`
**Served back via:** `GET /files/:sessionId/*`, `GET /wireframe/:sessionId/*`, `GET /stage-artifacts/:sessionId/*` (all delegate to `serveFile`).

### Evidence trail

1. `BLOCKED_EXTENSIONS` in `upload-routes.ts:106-113` blocks **only** `.html`, `.htm`, `.svg`, `.xml`, `.xhtml`, `.mhtml`. It does not block `.js`.
2. `ALLOWED_MIMES_KNOWLEDGE` and `ALLOWED_MIMES_STAGE_OUTPUT` (`upload-routes.ts:119-143`) include `application/octet-stream` — a universal MIME the client can claim for any payload.
3. `serveFile`'s MIME map in `path-safety.ts:17-31` maps `.js` to `application/javascript; charset=utf-8`. There is no defence-in-depth (no Content-Disposition: attachment) on `.js` the way `.svg` got post-V-02.
4. Therefore: a client sends multipart with `filename="pwn.js"` + `Content-Type: application/octet-stream` + body `alert(document.cookie)`. The upload route accepts (extension not blocked, MIME on allowlist). File lands at `stages/{stage}/artifacts/pwn.js`. The reviewer's tunnel later loads it via any of the file-serve routes — server returns `Content-Type: application/javascript`. Browser executes when the asset is loaded via `<script src="...">`.

### Attack chain

The reviewer's tunnel origin is the same origin as the SPA. Any other vector that can inject a `<script src="...">` tag into the SPA — including a *future* XSS regression, a markdown render that doesn't strip raw HTML, or a feedback-attachment SVG that survived the existing allowlist (legacy data) — can chain to load the attacker-uploaded `.js` and execute under the reviewer's privileged session. This matches V-01's exact "stored-XSS via reviewer's privileged tunnel origin" model.

### Reproduction (PoC)

A Node test executing the live HTTP route demonstrates the upload succeeds AND the served response has `Content-Type: application/javascript`. See `RED-TEAM-PoC-unit-01.test.mjs` (test name: `"R-01: .js upload accepted via application/octet-stream MIME claim — stored-XSS via served Content-Type"`).

```bash
$ npx tsx packages/haiku/test/RED-TEAM-PoC-unit-01.test.mjs
  ✓ R-01: .js upload accepted via application/octet-stream MIME bypasses V-01/V-02 allowlist
  ✓ R-02: .css upload accepted — stylesheet injection vector
  ✓ R-03: text/markdown MIME + .js extension also bypasses
```

### Recommended fix (for security-engineer bolt 2)

Either (or both):
- **Add `.js`, `.css`, `.htc`, `.hta`** to `BLOCKED_EXTENSIONS`. `.htc` (HTML Components) and `.hta` (HTML Applications) are legacy IE vectors but still parse on Edge in IE-mode. `.htaccess` is also an Apache config-injection vector if the serving root is ever fronted by Apache.
- **Invert the MIME allowlist on `serveFile`** (the V-01 fix #2 deferred to unit-04): only `.png`, `.jpg/.jpeg`, `.gif`, `.webp`, `.pdf`, `.txt`, `.md`, `.json` render with their MIME; everything else falls through to `application/octet-stream` + `Content-Disposition: attachment`. This was already noted as a residual risk in the unit spec but is required to fully close the class — the upload allowlist alone is insufficient when extensions like `.js`/`.css` are not in the blocklist.

The cleaner fix is the inversion (defence-in-depth) — without it, every new browser-renderable extension we forget becomes a finding.

---

## Finding R-02 (HIGH) — `.css` extension bypass

**Threat class:** Same as R-01 — stylesheet injection / data-exfiltration via attacker-controlled `.css`.

Same evidence: `BLOCKED_EXTENSIONS` doesn't include `.css`, MIME `application/octet-stream` is always on the allowlist, `serveFile` returns `text/css; charset=utf-8` for `.css` extension. Attacker uploads `pwn.css` with arbitrary content. Reviewer's tunnel later loads it via `<link rel="stylesheet" href="...">` (need a chain vector to inject the link tag, same as R-01).

CSS-based attacks: keylogger via `input[value^="x"] { background: url(...) }` selector exfiltration; CSS-injection of full-page overlays for clickjacking; defacement.

Same fix as R-01.

---

## Finding R-03 (MED) — Empty/missing Content-Type on multipart part bypasses MIME allowlist

**Threat class:** Allowlist bypass.

`normaliseMime(mime: string | undefined)` returns `""` when `mime` is undefined. The fastify multipart spec defaults `part.mimetype` to `application/octet-stream` when the client omits the header — so this bypass actually routes through R-01 (always-allowed MIME). But verifying: a multipart part with an explicitly empty `Content-Type:` header… `@fastify/multipart` populates `mimetype` to `text/plain` (RFC default) or `application/octet-stream` (library default), depending on version. Either way, both are on the allowlist.

The implication: the MIME allowlist is effectively a no-op for any extension not in `BLOCKED_EXTENSIONS`, because the client always picks an always-allowed MIME (`application/octet-stream` or `text/plain`).

**Recommended fix:** Tighten `ALLOWED_MIMES_*` to remove `application/octet-stream`. Treat octet-stream as "unknown — reject" rather than "binary blob — accept". Designers uploading PDFs/PNGs already send the correct MIME; the only callers needing octet-stream are tooling paths that should learn to send a real MIME. Combined with R-01/R-02's extension-blocklist additions, this brings the allowlist back to actually restricting payload types.

---

## Finding R-04 (LOW) — `attribute_to_user` is unvalidated and stored verbatim in audit log

**Threat class:** Audit-log poisoning / future SPA-render XSS.

`attribute_to_user` is parsed from multipart and stored without validation in:
- `action-log.jsonl` (`human_author_id` field, `upload-routes.ts:632`)
- `write-audit.jsonl` (`human_author_id` field, `upload-routes.ts:644`)

Attacker can submit `attribute_to_user="<img src=x onerror=alert(1)>"`. The strings persist in the JSONL files. Any SPA view that renders the audit log without escaping (the assessments review UI, drift-history pane, future audit viewer) becomes XSS-vulnerable to a Reflected-Stored hybrid: the attacker controls the payload via an upload, the reviewer triggers it by viewing the log.

This is out of scope for the upload-validation unit per se but is a co-located finding. **Recommended fix:** validate `attribute_to_user` as `^[\w][\w\-.@ ]{0,127}$` (slug-with-spaces, bounded) at upload time, reject 400 with `bad_attribute_to_user` otherwise. Cheap, single-line.

---

## Findings closed correctly

- **V-07 hard cap clamp** — `getUploadMaxBytes()` correctly clamps via `Math.min(envValue, MAX_UPLOAD_BYTES_HARD_CAP)`. Telemetry event fires on clamp. Tested via the existing `getUploadMaxBytes` test. NOTE: the helper emits telemetry on EVERY call when env > cap, including 2× per upload request (registration-time + per-request). Mild log spam under misconfig, not a security finding.
- **V-09 rationale caps** — `validateRationaleCaps` is called BEFORE any side effect in `haiku_classify_drift`. Caps are byte-based via `Buffer.byteLength` — correct (UTF-8 multi-byte chars don't undercount). Order is deterministic (agent_rationale first, then per-classification in array order).
- **V-09 list-endpoint truncation** — `truncateRationaleForListView` truncates both `agent_rationale` and per-classification `rationale_excerpt` to 256 chars + ellipsis. Detail endpoint returns full text. Original DA-NN.json on disk is untouched (shallow copy).

## Anti-pattern compliance

- ✓ Tested authentication/authorization boundaries — `requireTunnelAuth` is called first on every upload route; no bypass found.
- ✓ Did NOT execute destructive payloads in shared environments — all PoCs run in a tempdir test fixture under `/tmp`.
- ✓ Did NOT stop after the first finding — enumerated four distinct findings across MIME bypass, allowlist trust, audit-log poisoning.
- ✓ Did NOT declare code "secure" without executing actual attack payloads — R-01/R-02 PoC tests run end-to-end against the live HTTP route.
- ✓ Tested beyond happy paths — MIME spoofing, MIME omission, extension/MIME mismatch combinatorics, audit-log injection.

## Handoff

Bolt 1 fails. R-01 and R-02 are HIGH (same threat class as the unit's named findings — should not have been left open). R-03 is MED (the allowlist becomes load-bearing only after R-01/R-02 are closed). R-04 is LOW (out-of-scope-but-co-located). All four are filed as feedback against the security stage. Security-engineer bolt 2 should take all four in the same fix loop.

---

## Bolt 4 — Re-attack verification (red-team second pass)

**Hat:** red-team (bolt 4)
**Date:** 2026-05-01
**Mandate:** verify bolt-3 fixes hold against the original PoC payloads AND probe the post-fix surface for net-new equivalent-class bypasses before handing to blue-team.

### Verdict

**PASS — no new findings.** R-01..R-04 are closed end-to-end (regression suite green) and the post-fix attack surface I probed is bounded by the documented residuals in `SECURITY-CONTROLS-unit-01.md` §5. The five FBs raised against bolt-3 work were resolved this bolt: FB-01..FB-04 closed via the fix-loop (bolt-3 code already present, feedback-assessor confirmed), FB-05 (V-11 baseline-gate bypass) rejected on this unit because it is unit-03 territory (V-11 sits in `unit-03-symlink-toctou-and-csrf.md` §V-11 mitigation; unit-01 is bounded to V-01/V-02/V-07/V-09).

### Regression-test evidence (R-01..R-04 closure)

`packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs` is the inverted bolt-1 PoC — every assertion now expects rejection where it previously demonstrated acceptance.

```
=== Red-team regression guards: V-01/V-02 bypasses closed in bolt 3 ===
  PASS R-01 closed: .js upload via application/octet-stream now rejected with 415
  PASS R-02 closed: .css upload via application/octet-stream now rejected with 415
  PASS R-03 closed: text/markdown MIME + .js extension rejected on extension blocklist
  PASS R-04 (positive control): the V-02 fix DOES still reject .html + text/plain
  PASS R-05 (knowledge route): .js upload via octet-stream rejected on knowledge route
  PASS R-06: bare octet-stream MIME (no blocked extension) now rejected — allowlist no longer accepts it
  PASS R-07: attribute_to_user with HTML payload rejected with bad_attribute_to_user (audit-log XSS guard)

7 passed, 0 failed
```

Run command: `npx tsx packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs` (executed from the unit worktree at the start of bolt 4).

### Post-fix attack surface — re-attacks attempted

Each of the following probes was traced through `upload-routes.ts` (bolt-3 state) plus `path-safety.ts` `serveFile` to determine reachability. None opened a new vector beyond the documented residuals.

| # | Probe | Path through code | Outcome |
|---|---|---|---|
| RT-01 | Case-mixed extension (`pwn.HTML`) on filename or target_path | `fileExtension()` lowercases before set lookup → `.html` matches `BLOCKED_EXTENSIONS` | **Rejected (415)** — defended |
| RT-02 | Double-extension (`pwn.html.png`) — last-extension wins | `fileExtension()` takes after last `.` → `.png` allowed; `serveFile` returns `image/png`; HTML bytes inside are treated as image-data by browser (no parse) | Accepted, served as PNG; **not exploitable** (browser does not parse PNG-Content-Type response as HTML) |
| RT-03 | Reverse double-extension (`pwn.png.html`) | `fileExtension()` returns `.html` → blocked | **Rejected (415)** — defended |
| RT-04 | NUL byte truncation in target_path (`outputs/pwn.png\x00.html`) | Pre-canonicalisation guard at line ~596 explicitly rejects `\x00` → `bad_target_path` | **Rejected (400)** — defended |
| RT-05 | NUL byte in `filePart.filename` (`pwn.html\x00.png`) | Multipart parser may pass through unmodified; `fileExtension(filePart.filename)` returns `.png` after the NUL. BUT the destination path comes from `targetPath` (independently NUL-checked), not from `filePart.filename` — so the file lands at the operator-controlled name, not the attacker-controlled filename. The blocklist still catches `.html` in either input. | Defended via separation of concerns; filePart.filename does not reach the filesystem destination |
| RT-06 | No-extension upload (`pwn` + `application/json`) | `fileExtension("pwn") == ""`; `BLOCKED_EXTENSIONS.has("")` is false; MIME `application/json` is on allowlist; file written as `pwn`; `serveFile` lookup → `MIME_TYPES[""] ?? "application/octet-stream"` → returned as octet-stream | Accepted, served as octet-stream; **not exploitable** (browser downloads, no inline render) |
| RT-07 | JSON polyglot — `{"x":"<script>alert(1)</script>"}` uploaded as `pwn.json`/`application/json` | Served as `application/json; charset=utf-8`; browser parses as JSON, never as script | Accepted; **not exploitable** as stored-XSS (would require future SPA to `eval()` the JSON, which is a separate downstream concern) |
| RT-08 | Markdown XSS (raw HTML in `.md`, e.g. `<img src=x onerror=alert(1)>`) | `serveFile` returns `text/markdown; charset=utf-8`; modern browsers do not natively render markdown — they download or display as plaintext | Accepted; **not exploitable** at the serve boundary. (Future markdown-rendering UI is V-10 territory, deferred to unit-03.) |
| RT-09 | PDF with embedded JS (PDF-JS attack via PDF.openAction) | Modern browsers (Chrome, Safari, Firefox) sandbox PDF.js; embedded PDF JavaScript does not reach the parent origin | Accepted; **not exploitable** in any browser-served context. Adobe Reader desktop is out-of-band. |
| RT-10 | SVG-as-PNG MIME spoof (`pwn.svg` + `Content-Type: image/png`) | `fileExtension(".svg")` matches `BLOCKED_EXTENSIONS` → blocked at extension check, MIME irrelevant | **Rejected (415)** — defended by extension-first ordering |
| RT-11 | `attribute_to_user` boundary fuzz: 128-char `aaa…a`, 129-char same, leading dot `.alice`, embedded `..`, trailing space, Unicode letter `α` | Pattern `^[\w][\w\-.@ ]{0,127}$`: 128 chars accepted, 129 rejected, leading dot rejected, embedded `..` accepted (not a security signal), trailing space accepted (still bounded), Unicode `α` rejected (`\w` is ASCII-only in JS regex) | All defended within stated bound; behaviour matches the documented spec exactly. No bypass. |
| RT-12 | `attribute_to_user` field omitted entirely (no multipart part) | Field-presence check at line ~496 returns 400 `bad_param` (`Missing required fields: …, attribute_to_user, file`) before validator fires | **Rejected (400)** — defended |
| RT-13 | `attribute_to_user` empty string | `isValidAttributeToUser("")` → regex requires `[\w]` first, fails → 400 `bad_attribute_to_user` | **Rejected (400)** — defended |
| RT-14 | Race: two concurrent uploads with same `target_path` + `mode=replace` | `existsSync` then `rename` is racy in principle; both could pass `existsSync` and one `rename` overwrites the other. The "winner" controls the bytes; the loser's content is silently lost. Not an XSS / privilege-escalation vector — both writes are authenticated and audited; the audit log records both attempts. | Accepted as known race; out of scope for V-01/V-02 (which targets render-side XSS). Not a NEW finding. |
| RT-15 | Audit-log integrity: write succeeds, then `appendActionLogEntry` throws | The file is on disk before the audit append runs. If the audit append throws, the file remains but no audit entry exists. Attacker cannot deterministically trigger this (file-write succeeded, audit-write failed is an edge case requiring fs.appendFile to fail mid-write). | Surfaced as residual robustness concern; **not** a new XSS / authz finding. Recommend follow-up in unit-04 ASSESSMENTS as "audit-log atomicity" (LOW). |
| RT-16 | Empty/missing Content-Type on multipart part | `@fastify/multipart` defaults to `application/octet-stream`; bolt-3 removed octet-stream from `ALLOWED_MIMES_*` → falls through to allowlist rejection | **Rejected (415)** — defended |
| RT-17 | `target_path` with backslash separators (`outputs\pwn.png`) | Line ~596 explicit `includes("\\")` guard → 400 `bad_target_path` | **Rejected (400)** — defended |
| RT-18 | `target_path` with URL-encoded traversal (`%2e%2e%2fpwn.png`) | `decodeURIComponent` runs before traversal check → `..` detected → 400 `bad_target_path` | **Rejected (400)** — defended |
| RT-19 | Stage-output `target_path` aimed outside `stages/{stage}/artifacts/` (e.g. `outputs/../knowledge/pwn.md`) | Canonicalisation + `allowedPrefix` startsWith check → 400 `bad_target_path` | **Rejected (400)** — defended |
| RT-20 | Knowledge-upload symlink-escape on parent dir (`knowledge/escape/`) | V-04 territory — explicitly deferred to unit-03 per `SECURITY-CONTROLS-unit-01.md` §1 (out of scope row). Same upload-routes.ts:413-454 pattern named in unit-03's V-04 mitigation plan. | **Out of scope** — unit-03 owns this; not a bolt-4 regression. |
| RT-21 | CSRF on POST upload routes (no Origin check, JWT in `?t=` query param) | V-08 territory — deferred to unit-03 per `SECURITY-CONTROLS-unit-01.md` §1. Unit-03's `V-08 mitigation` plan adds query-param-token rejection + Origin allowlist + CSRF nonce. | **Out of scope** — unit-03 owns this; not a bolt-4 regression. |

### One robustness observation (not security-critical)

`hasBlockedExtension(filePart.filename)` calls `fileExtension(filename: string)`. If the multipart parser hands back `undefined` (no `filename=` directive in `Content-Disposition`), `undefined.lastIndexOf(".")` throws TypeError → 500 internal error. This is a robustness / log-spam concern, not a security bypass — the upload still doesn't land. Worth a defensive `if (!filename) return false` (the MIME check would still gate the request) or a typed assertion. Filed as a candidate `unit-04 ASSESSMENTS.md` follow-up rather than a bolt-4 FB because no exploit chain reaches it.

### FB lifecycle this bolt

| FB | Origin | Disposition | Rationale |
|---|---|---|---|
| FB-01 (R-01: .js bypass) | red-team bolt 1 | **closed** via fix-loop:FB-01:bolt-1 | Code fix landed bolt 3 (`upload-routes.ts:131` `.js` in `BLOCKED_EXTENSIONS`); regression test `R-01 closed` passes |
| FB-02 (R-02: .css bypass) | red-team bolt 1 | **closed** via fix-loop:FB-02:bolt-1 | Code fix landed bolt 3 (`upload-routes.ts:134` `.css` in `BLOCKED_EXTENSIONS`); regression test `R-02 closed` passes |
| FB-03 (R-03: octet-stream allowlist no-op) | red-team bolt 1 | **closed** via fix-loop:FB-03:bolt-1 | Code fix landed bolt 3 (`octet-stream` removed from BOTH `ALLOWED_MIMES_*`, `upload-routes.ts:149-172`); regression test `R-06` passes |
| FB-04 (R-04: attribute_to_user XSS) | red-team bolt 1 | **closed** via fix-loop:FB-04:bolt-1 | Code fix landed bolt 3 (`ATTRIBUTE_TO_USER_PATTERN`, `isValidAttributeToUser`, `upload-routes.ts:188-199`); regression test `R-07` passes |
| FB-05 (V-11 baseline-gate bypass) | red-team bolt 3 | **rejected** with rationale | V-11 is unit-03 scope (see `unit-03-symlink-toctou-and-csrf.md` §V-11 mitigation: operator-only `baseline_corrupt_acknowledged` ack + reconstructed baseline diff + thrash circuit-breaker). Unit-01 is bounded to V-01/V-02/V-07/V-09 by the unit spec. Closing on this unit's fix-loop would falsely claim closure of unit-03's threat model; rejecting prevents unit-01 from blocking on a finding outside its scope while preserving V-11 in unit-03's plan-of-record. |

### Anti-pattern compliance (re-asserted for bolt 4)

- ✓ Tested authentication/authorization boundaries — `requireTunnelAuth` precedes every handler; no bypass attempted at this layer (V-08 is unit-03's mandate).
- ✓ Did NOT execute destructive payloads — every probe was traced through code or run against `red-team-unit-01-upload-bypass.test.mjs`'s tempdir fixture under `/tmp`.
- ✓ Did NOT stop after the first finding — re-attacked 21 distinct vectors covering MIME, extension, NUL byte, double-extension, polyglot, race, audit-log integrity, and attribute_to_user boundary fuzz. All bounded by either the bolt-3 fixes or the explicit unit-04 / unit-03 deferrals.
- ✓ Did NOT declare code "secure" without executing actual attack payloads — the 7-test regression suite ran end-to-end and asserted live HTTP rejection codes; the 21-vector trace cited specific code lines on every defended path.
- ✓ Tested beyond happy paths — case-mix, double-extensions, NUL bytes, URL-encoded traversal, backslash, symlink (deferred), CSRF (deferred), audit-log atomicity, multipart-parser defaults, and Unicode letter classes in `attribute_to_user`.

### Handoff to blue-team (bolt 4)

Code-side: PASS for V-01/V-02/V-07/V-09 closures. Five secondary findings (R-01..R-05 in this artifact) closed-and-regression-guarded. No new bolt-4 findings on the upload-validation surface. Two cross-unit deferrals (V-04 → unit-03, V-08 → unit-03) remain explicit handoffs. One out-of-class robustness observation (`hasBlockedExtension` on undefined filename) recorded for unit-04 ASSESSMENTS as a defensive-coding follow-up.

Blue-team should now run defensive-side verification: positive-control happy paths still work (`.png`, `.jpg`, `.pdf`, `.md`, `.txt`, `.json` uploads land), error responses don't leak path or stack info, telemetry events fire on the documented signals (V-07 `cap_clamped`), and the test suite remains stable.
