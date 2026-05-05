# Security Controls — unit-01 Upload Content Validation

This is the security-engineer hat's deliverable for `unit-01-upload-content-validation`.
It maps every applicable threat from `THREAT-MODEL-unit-01.md` (read alongside
this document) to a concrete control with file-level citations and test-level
verification, plus an explicit residual-risk register for what's deferred.

The unit's own markdown body holds the scope/approach/criteria contract;
this artifact holds the security narrative that the security-reviewer hat
verifies against the threat model.

## 1. Surface scope

The two SPA upload routes that accept human-authored bytes into the intent
directory:

- `POST /api/intents/:intent/uploads/knowledge` — single multipart file plus
  `target_filename`, optional `stage` scope, `attribute_to_user`. Lands at
  `knowledge/{filename}` (intent scope) or `stages/{stage}/knowledge/{filename}`
  (stage scope).
- `POST /api/intents/:intent/uploads/stage-output` — single multipart file
  plus `stage`, `target_path`, `mode`, `attribute_to_user`. Lands under
  `stages/{stage}/artifacts/{target_path}` after path canonicalisation.

The trust boundary crossed is the tunnel edge (`requireTunnelAuth` — HS256
JWT with `tun` + `sid` claims). Past auth, the route streams to a tempfile
via `streamToTempfile` and renames into place. Once the bytes land they are
indistinguishable from any other file in the intent dir and feed the
downstream drift-gate read-back path, the action-log / write-audit append
path, and the file-serve routes (`/files/:sid/...`, `/stage-artifacts/:sid/...`).

Data classes handled: human-authored knowledge artifacts (markdown, PDFs,
screenshots, structured data) and human-authored stage outputs (designer
mockups, screenshots, structured data). The companion vulnerability —
unbounded rationales bloating drift-assessment records (V-09) — is on the
`haiku_classify_drift` MCP tool plus the `assessments-routes.ts` list
endpoint, which closes the same data flow at its terminal node (reviewer
SPA reads back the assessment records the agent writes).

Out of scope (handed to siblings, see threat-model §7): author-identity
binding (V-03 → unit-02), TOCTOU on intermediate dirs (V-04 → unit-03),
CSRF on mutating routes (V-08 → unit-03), serve-side hardening (V-01
fix #2/#3, V-02 sandboxed sub-origin → unit-04 residual risk).

## 2. Threat coverage

Mapping every applicable threat from `THREAT-MODEL-unit-01.md` (§4 STRIDE
matrix + §8 disposition table) to the control implemented here.

| Threat (severity) | Control | Implementation site | Test |
|---|---|---|---|
| Knowledge XSS via served file in tunnel origin (extension class includes `.html`/`.htm`/`.xhtml`/`.mhtml`/`.svg`/`.xml` AND bolt-3 additions `.js`/`.mjs`/`.cjs`/`.css`/`.htc`/`.hta`/`.htaccess`) **(HIGH, V-01 + red-team R-01/R-02)** | `BLOCKED_EXTENSIONS` set (broadened in bolt 3) + `ALLOWED_MIMES_KNOWLEDGE` allowlist (octet-stream removed in bolt 3); reject with **415 unsupported_media_type** before any byte is written. **Bound (FB-34):** the allowlist matches the *claimed* MIME (`filePart.mimetype`) and the *filename extension*. It does **not** sniff the leading bytes, so a payload of `<html>…</html>` shipped as `image/png` with extension `.png` passes both checks at the upload boundary. Closure of I-1 here therefore depends on the serve-side defenses tracked under R-1 (extension-driven `MIME_TYPES[ext]` + browser respect for image Content-Type) and on the new R-6 magic-byte residual; see §5 and ASSESSMENTS.md R-6. | `upload-routes.ts` `BLOCKED_EXTENSIONS`, `ALLOWED_MIMES_KNOWLEDGE`, knowledge-route handler post-`bad_param` block | `upload-routes.test.mjs`: `"knowledge: text/html upload rejected with 415 (V-01: html upload rejected)"`, `"knowledge: .svg upload rejected even when MIME claims image/svg+xml (V-01)"`, `"knowledge: .js upload rejected with 415 (red-team R-01 on knowledge route)"`, `"knowledge: octet-stream rejected (red-team R-03 on knowledge route)"`; `red-team-unit-01-upload-bypass.test.mjs`: `"R-05 (knowledge route): .js upload via octet-stream rejected on knowledge route"` |
| Stage-output XSS same class (extension class as above) **(HIGH, V-02 + red-team R-01/R-02)** | `ALLOWED_MIMES_STAGE_OUTPUT` allowlist (octet-stream removed in bolt 3) + same broadened `BLOCKED_EXTENSIONS`; reject with **415** before write. **Same bound as V-01 (FB-34)** — the allowlist trusts the multipart-claimed MIME and the filename extension, not the byte content. Stage-output mockups uploaded as `image/png` containing renderable bytes pass the upload check; the residual under R-6 covers magic-byte sniffing as the upgrade path. | `upload-routes.ts` `ALLOWED_MIMES_STAGE_OUTPUT`, stage-output-route handler post-`bad_param` block | `upload-routes.test.mjs`: `"stage-output: text/html upload rejected with 415 unsupported_media_type (V-02)"`, `"stage-output: .svg upload rejected even when MIME claims image/svg+xml (V-02)"`, `"stage-output: .js upload rejected with 415 — same threat class as V-02 (red-team R-01)"`, `"stage-output: .css upload rejected with 415 — stylesheet injection vector (red-team R-02)"`, `"stage-output: .mjs/.cjs/.htc/.hta/.htaccess all rejected with 415 (red-team R-01 sibling vectors)"`; `red-team-unit-01-upload-bypass.test.mjs`: `"R-01 closed: .js upload via application/octet-stream now rejected with 415"`, `"R-02 closed: .css upload via application/octet-stream now rejected with 415"` |
| Allowlist no-op via `application/octet-stream` (multipart default MIME) **(MED, red-team R-03)** | `application/octet-stream` removed from BOTH `ALLOWED_MIMES_KNOWLEDGE` and `ALLOWED_MIMES_STAGE_OUTPUT`; the allowlist now restricts payload types as advertised. Legitimate binary uploads (PDFs, images) send their real MIME; tooling that previously sent octet-stream must learn to send the correct type | `upload-routes.ts` `ALLOWED_MIMES_STAGE_OUTPUT`, `ALLOWED_MIMES_KNOWLEDGE` (octet-stream omitted) | `upload-routes.test.mjs`: `"stage-output: application/octet-stream MIME now rejected (red-team R-03 — allowlist no longer accepts the multipart default)"`, `"knowledge: octet-stream rejected (red-team R-03 on knowledge route)"`; `red-team-unit-01-upload-bypass.test.mjs`: `"R-06: bare octet-stream MIME (no blocked extension) now rejected — allowlist no longer accepts it"` |
| Audit-log poisoning / future SPA-render XSS via unvalidated `attribute_to_user` **(LOW, red-team R-04)** | `ATTRIBUTE_TO_USER_PATTERN = /^[\w][\w\-.@ ]{0,127}$/` — slug-with-spaces bound enforced at upload time on BOTH routes; reject with **400 bad_attribute_to_user**. Bound is wide enough for real human IDs (`alice`, `Alice Smith`, `alice.smith@example.com`, `product-owner-2`) but rejects every HTML / JS sigil and shell metacharacter, so the audit log cannot store an attacker-shaped string | `upload-routes.ts` `ATTRIBUTE_TO_USER_PATTERN`, `isValidAttributeToUser()`; both route handlers reject right after the field-presence check, before the extension/MIME branch | `upload-routes.test.mjs`: `"stage-output: attribute_to_user with HTML payload rejected with bad_attribute_to_user (red-team R-04 audit-log XSS guard)"`, `"knowledge: attribute_to_user with shell metacharacters rejected (red-team R-04)"`, `"attribute_to_user: realistic legitimate identities accepted (no false positives on R-04)"`; `red-team-unit-01-upload-bypass.test.mjs`: `"R-07: attribute_to_user with HTML payload rejected with bad_attribute_to_user (audit-log XSS guard)"` |
| MIME spoof — `text/plain` (or `image/png`) claim with renderable extension in filename **(MED, V-01/V-02 variant)** | Extension blocklist applies to BOTH `filePart.filename` AND `target_filename`/`target_path` independently — extension wins over claimed MIME | `upload-routes.ts` `hasBlockedExtension(filePart.filename)` and `hasBlockedExtension(targetFilename)` / `hasBlockedExtension(targetPath)` checked separately, with extension-blocked rejected first regardless of MIME | `upload-routes.test.mjs`: `"stage-output: MIME spoof — text/plain claim with .html filename rejected (V-02 defence-in-depth)"`; `"stage-output: target_path with .html extension rejected even when uploaded filename is safe (V-02)"`; `"knowledge: MIME spoof rejected — text/plain claim with .html target_filename (V-01 defence-in-depth)"`; `red-team-unit-01-upload-bypass.test.mjs`: `"R-03 closed: text/markdown MIME + .js extension rejected on extension blocklist"` |
| Operator misconfig of `HAIKU_UPLOAD_MAX_BYTES` (extra zero) **(MED, V-07)** | `MAX_UPLOAD_BYTES_HARD_CAP = 50 * 1024 * 1024`; `getUploadMaxBytes()` returns `Math.min(envValue, hardCap)`; `haiku.upload.cap_clamped` telemetry event when clamping fires | `upload-routes.ts` `MAX_UPLOAD_BYTES_HARD_CAP`, `getUploadMaxBytes()` (exported for unit-test assertion), `UPLOAD_MAX_BYTES_HARD_CAP` exported constant | `upload-routes.test.mjs`: `"HAIKU_UPLOAD_MAX_BYTES clamps to MAX_UPLOAD_BYTES_HARD_CAP (50 MiB) when env exceeds the hard cap (V-07: hard cap upload clamp)"` — direct unit-level assertion on `getUploadMaxBytes()` for both clamp and below-cap pass-through |
| Drift-gate sync-SHA stall on multi-GB file **(MED, V-07 cascade)** | Bounded by the upload-side hard cap above — no additional control here | `upload-routes.ts` (control above) | Covered transitively by the V-07 test; deeper async-hash work is deferred |
| Unbounded `agent_rationale` write **(LOW, V-09 fix #1)** | `MAX_RATIONALE_BYTES = 10 * 1024` schema cap; `validateRationaleCaps()` helper; `haiku_classify_drift` rejects with `agent_rationale_too_long` structured error before DA-NN.json write | `state-tools.ts` `MAX_RATIONALE_BYTES`, `validateRationaleCaps()`; `tools/orchestrator/haiku_classify_drift.ts` cap-violation branch | `state-tools-handlers.test.mjs`: `"validateRationaleCaps: agent_rationale > 10 KB returns agent_rationale_too_long structured error (V-09 agent_rationale reject)"`; `"validateRationaleCaps: passes when both fields are within caps"`; `"validateRationaleCaps: agent_rationale checked BEFORE per-finding excerpts (deterministic order)"` |
| Unbounded per-finding `rationale_excerpt` write **(LOW, V-09 fix #1)** | `MAX_RATIONALE_EXCERPT_BYTES = 1024` schema cap; same validator returns `rationale_excerpt_too_long` with index/path | `state-tools.ts` `MAX_RATIONALE_EXCERPT_BYTES`; same `validateRationaleCaps()` | `state-tools-handlers.test.mjs`: `"validateRationaleCaps: rationale_excerpt over 1KB returns rationale_excerpt_too_long structured error (V-09: rationale over KB reject)"`; `"validateRationaleCaps: byte-counting is UTF-8, not UTF-16 (multi-byte char that fits in code units but not bytes is rejected)"` (defends against multi-byte char undercount) |
| Unbounded list-endpoint read **(LOW, V-09 fix #2)** | `TRUNCATE_RATIONALE_PREVIEW_CHARS = 256`; list handler returns truncated copy with `…` marker; detail endpoint returns full text untouched | `assessments-routes.ts` `truncateRationaleForListView()`, applied in list handler `assessments.push(...)` loop | `assessments-routes.test.mjs`: `"list endpoint truncates agent_rationale to a list-view-safe preview (V-09)"`; `"list endpoint truncates per-classification rationale_excerpt (V-09)"`; `"list endpoint leaves short rationales untouched (no spurious truncation)"`; `"detail endpoint returns FULL agent_rationale + rationale_excerpt — no truncation (V-09)"` |
| Author-id spoofing on `attribute_to_user` (V-03) | **Deferred — unit-02** | n/a (cross-reference) | n/a |
| TOCTOU on intermediate dirs (V-04), CSRF on `?t=` (V-08) | **Deferred — unit-03** | n/a (cross-reference) | n/a |
| Serve-side: invert MIME map; CSP on knowledge artifacts; sandboxed sub-origin for HTML mockups | **Deferred — unit-04 residual risk** (must file `stage_revisit` follow-up FB) | n/a (cross-reference) | n/a |
| Markdown sanitization on agent-authored feedback (V-10) | **Out of scope** for this unit (handed to unit-04) | n/a | n/a |

Every HIGH/MED/LOW threat in the threat model has a disposition above. The
three "Deferred" rows carry the same target stage (unit-02 / unit-03 / unit-04
residual register) named in the threat-model handoff section so the downstream
hats inherit the boundary.

## 3. Implementation references

All paths are repository-relative; line numbers are approximate (anchored to
the helper or constant name so they survive light edits).

### 3.1 V-01 / V-02 controls (incl. red-team R-01/R-02/R-03/R-04 closures)

- `packages/haiku/src/http/upload-routes.ts`
  - `BLOCKED_EXTENSIONS: ReadonlySet<string>` — the renderable-script
    extension blocklist. Bolt 1: `.html`, `.htm`, `.svg`, `.xml`,
    `.xhtml`, `.mhtml`. **Bolt 3 additions** (close red-team R-01/R-02 +
    sibling vectors): `.js`, `.mjs`, `.cjs`, `.css`, `.htc`, `.hta`,
    `.htaccess`. `serveFile` returns `application/javascript` for `.js`/
    `.mjs`/`.cjs` and `text/css` for `.css`, both of which execute under
    the tunnel origin (same XSS / stylesheet-injection class V-01/V-02
    named). `.htc` (HTML Components, IE-mode-on-Edge), `.hta` (HTML
    Applications), and `.htaccess` (Apache config injection if the serve
    root is fronted by Apache) are fellow-traveler vectors.
  - `ALLOWED_MIMES_STAGE_OUTPUT: ReadonlySet<string>` — per-route MIME
    allowlist for the stage-output handler. **Bolt 3:** `application/
    octet-stream` removed (closes red-team R-03). It was the multipart
    default MIME a client sends when no Content-Type is set, which made
    the allowlist effectively a no-op for any extension not in
    `BLOCKED_EXTENSIONS`. Treat octet-stream as "unknown — reject."
    Legitimate binary uploads (PDFs, PNGs, JPEGs) already send their real
    MIME; tooling that previously used octet-stream must learn to send
    the correct type.
  - `ALLOWED_MIMES_KNOWLEDGE: ReadonlySet<string>` — per-route MIME
    allowlist for the knowledge handler. Same bolt-3 octet-stream
    removal.
  - `ATTRIBUTE_TO_USER_PATTERN = /^[\w][\w\-.@ ]{0,127}$/` — bolt-3
    addition (closes red-team R-04). Slug-with-spaces bound on the
    `attribute_to_user` multipart field. Wide enough for real human IDs
    (`alice`, `alice.smith@example.com`, `Alice Smith`, `product-owner-2`)
    but rejects every HTML/JS sigil and shell metacharacter, so the
    `human_author_id` field written to `action-log.jsonl` and
    `write-audit.jsonl` cannot store an attacker-shaped string. Future
    SPA audit-log viewers therefore cannot become a stored-XSS sink.
  - `isValidAttributeToUser(value)` — exported helper used by both routes
    and a unit test.
  - `fileExtension(filename)` — lowercases and extracts the dot-prefixed
    suffix.
  - `normaliseMime(mime)` — strips `;charset=…` and lowercases the primary
    type/subtype.
  - `hasBlockedExtension(filename)` — single-call check used by both routes.
  - Stage-output handler order: field-presence → `attribute_to_user` bound
    → extension blocklist (`hasBlockedExtension(filePart.filename)` and
    `hasBlockedExtension(targetPath)`) → MIME allowlist
    (`ALLOWED_MIMES_STAGE_OUTPUT.has(normaliseMime(filePart.mimetype))`)
    → `mode` validation. Earliest reject wins; the audit-log poisoning
    guard fires before any byte is written or any audit entry stamped.
  - Knowledge handler: same order, swapped to
    `hasBlockedExtension(targetFilename)` and `ALLOWED_MIMES_KNOWLEDGE`.

### 3.2 V-07 controls

- `packages/haiku/src/http/upload-routes.ts`
  - `MAX_UPLOAD_BYTES_HARD_CAP = 50 * 1024 * 1024` — the hard cap.
  - `UPLOAD_MAX_BYTES_HARD_CAP` — re-exported constant for tests.
  - `getUploadMaxBytes()` — exported for unit-level test assertion;
    returns `Math.min(envValue, MAX_UPLOAD_BYTES_HARD_CAP)`. Emits
    `haiku.upload.cap_clamped` telemetry with `env_value` + `hard_cap`
    attributes when clamping fires (so operators see the misconfig
    without a stack trace).
- `streamToTempfile(part, destDir, maxBytes)` — receives the clamped
  `maxBytes` argument; the per-chunk byte counter still triggers
  `payload_too_large` (413) at exactly the clamped value.
- Drive-by fix landed in the same edit: `streamToTempfile`'s overflow
  cleanup now `await`s the writestream's `close` event before
  `unlinkSync`, fixing a pre-existing race where the async stream-close
  could recreate the inode after a sync unlink (intermittent test failure:
  "Expected no temp files, found .upload-NNN.tmp"). Cited here so the
  security-reviewer can confirm the V-07 streaming path doesn't silently
  leak tempfiles on overflow rejection.

### 3.3 V-09 fix #1 controls (rationale schema caps)

- `packages/haiku/src/state-tools.ts`
  - `MAX_RATIONALE_BYTES = 10 * 1024` — `agent_rationale` cap.
  - `MAX_RATIONALE_EXCERPT_BYTES = 1024` — per-classification
    `rationale_excerpt` cap.
  - `RationaleCapViolation` discriminated union (kinds:
    `agent_rationale_too_long`, `rationale_excerpt_too_long`).
  - `validateRationaleCaps({agent_rationale, classifications})` — the
    pure validator. Counts UTF-8 bytes (not UTF-16 code units), checks
    `agent_rationale` first, then walks classifications in array order.
    Returns `null` on pass.
  - `utf8ByteLength(s)` — wraps `Buffer.byteLength(s, "utf-8")`.
- `packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts`
  - Imports `validateRationaleCaps`, `MAX_RATIONALE_BYTES`,
    `MAX_RATIONALE_EXCERPT_BYTES` from `state-tools.js`.
  - Cap check inserted directly after the existing `empty_rationale`
    check (before the dispatch lookup so no side effects can fire).
    Returns `errorResponse("agent_rationale_too_long", …, {bytes, cap,
    max_rationale_bytes})` or `errorResponse("rationale_excerpt_too_long",
    …, {index, path, bytes, cap, max_rationale_excerpt_bytes})`.

### 3.4 V-09 fix #2 controls (list-endpoint truncation)

- `packages/haiku/src/http/assessments-routes.ts`
  - `TRUNCATE_RATIONALE_PREVIEW_CHARS = 256` — the visible-character
    budget.
  - `truncateRationale(value)` — slice + `…` postfix.
  - `truncateRationaleForListView(assessment)` — shallow-copies the
    Assessment record, truncates `agent_rationale` and every
    classification's `rationale_excerpt`. Original on-disk record is
    untouched.
  - List handler (`GET /api/intents/:intent/assessments`): the per-page
    push loop is `assessments.push(truncateRationaleForListView(a))`
    instead of `assessments.push(a)`.
  - Detail handler (`GET /api/intents/:intent/assessments/:id`): unchanged
    — returns the full record.

## 4. Test references

Every control above is exercised by at least one named test. Suite:
`bun run --cwd packages/haiku test` — full suite passes (1183/0 across
60 test files at this writing, stable across three consecutive runs).

### 4.1 Upload-route tests (V-01 / V-02 / V-07 + bolt-3 hardening)

- `packages/haiku/test/upload-routes.test.mjs`
  - **V-02 (stage-output) — extension/MIME allowlist:**
    - `"stage-output: text/html upload rejected with 415 unsupported_media_type (V-02)"`
    - `"stage-output: MIME spoof — text/plain claim with .html filename rejected (V-02 defence-in-depth)"`
    - `"stage-output: .svg upload rejected even when MIME claims image/svg+xml (V-02)"`
    - `"stage-output: target_path with .html extension rejected even when uploaded filename is safe (V-02)"`
  - **V-01 (knowledge) — extension/MIME allowlist:**
    - `"knowledge: text/html upload rejected with 415 (V-01: html upload rejected)"`
    - `"knowledge: MIME spoof rejected — text/plain claim with .html target_filename (V-01 defence-in-depth)"`
    - `"knowledge: .svg upload rejected even when MIME claims image/svg+xml (V-01)"`
  - **V-07 — hard cap clamp:**
    - `"HAIKU_UPLOAD_MAX_BYTES clamps to MAX_UPLOAD_BYTES_HARD_CAP (50 MiB) when env exceeds the hard cap (V-07: hard cap upload clamp)"`
    — exercises both the clamp and the below-cap pass-through. The
    pre-existing 413 streaming-overflow test continues to cover the runtime
    size-cap enforcement path.
  - **Bolt-3 hardening — equivalent-class bypass + audit-log poisoning closed:**
    - `"stage-output: .js upload rejected with 415 — same threat class as V-02 (red-team R-01)"`
    - `"stage-output: .css upload rejected with 415 — stylesheet injection vector (red-team R-02)"`
    - `"stage-output: .mjs/.cjs/.htc/.hta/.htaccess all rejected with 415 (red-team R-01 sibling vectors)"`
    - `"stage-output: application/octet-stream MIME now rejected (red-team R-03 — allowlist no longer accepts the multipart default)"`
    - `"knowledge: .js upload rejected with 415 (red-team R-01 on knowledge route)"`
    - `"knowledge: octet-stream rejected (red-team R-03 on knowledge route)"`
    - `"stage-output: attribute_to_user with HTML payload rejected with bad_attribute_to_user (red-team R-04 audit-log XSS guard)"`
    - `"knowledge: attribute_to_user with shell metacharacters rejected (red-team R-04)"`
    - `"attribute_to_user: realistic legitimate identities accepted (no false positives on R-04)"` — guards the bound from over-narrow regression that would reject `Alice Smith`, `alice.smith@example.com`, `product-owner-2`.
  - **Pre-existing fixtures rewritten:** the original tests used `.html`
    files (e.g. `dashboard-layout.html`) which are now blocked. They were
    rewritten to `.md` with explicit `text/markdown` content-type so they
    exercise the "happy path" through the new allowlist instead of
    regressing into 415s. The four tests that previously omitted
    `contentType` (defaulting to `application/octet-stream` in the test
    helper) were updated to send their real MIME (`text/markdown` or
    `text/plain`); the helper's default was also changed to `text/plain`
    so that tests that don't care about MIME do not accidentally exercise
    the bolt-3 octet-stream rejection path. Coverage of the original
    behaviours (atomic write, action-log/audit-log stamping, mode
    enforcement, locked/archived/sealed gates, path-traversal) is preserved.

- `packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs` — bolt-1
  bypass PoC, **inverted in bolt 3** to assert REJECTION (415 / 400)
  instead of the original 200. Now serves as a regression guard: any
  future change that re-introduces `.js` / `.css` / `application/octet-
  stream` / unvalidated `attribute_to_user` will fail this test
  immediately.
  - `"R-01 closed: .js upload via application/octet-stream now rejected with 415"`
  - `"R-02 closed: .css upload via application/octet-stream now rejected with 415"`
  - `"R-03 closed: text/markdown MIME + .js extension rejected on extension blocklist"`
  - `"R-04 (positive control): the V-02 fix DOES still reject .html + text/plain"`
  - `"R-05 (knowledge route): .js upload via octet-stream rejected on knowledge route"`
  - `"R-06: bare octet-stream MIME (no blocked extension) now rejected — allowlist no longer accepts it"`
  - `"R-07: attribute_to_user with HTML payload rejected with bad_attribute_to_user (audit-log XSS guard)"`

### 4.2 Rationale-cap tests (V-09 fix #1)

- `packages/haiku/test/state-tools-handlers.test.mjs`
  - `"validateRationaleCaps: passes when both fields are within caps"`
  - `"validateRationaleCaps: agent_rationale > 10 KB returns agent_rationale_too_long structured error (V-09 agent_rationale reject)"` — also asserts `MAX_RATIONALE_BYTES === 10 * 1024` so a future regression that bumps the cap fails loudly.
  - `"validateRationaleCaps: rationale_excerpt over 1KB returns rationale_excerpt_too_long structured error (V-09: rationale over KB reject)"` — asserts exact 1 KB cap, surfaces `index` + `path`.
  - `"validateRationaleCaps: agent_rationale checked BEFORE per-finding excerpts (deterministic order)"` — guards the validator's canonical reporting order.
  - `"validateRationaleCaps: byte-counting is UTF-8, not UTF-16 (multi-byte char that fits in code units but not bytes is rejected)"` — uses 300 fire emojis (600 UTF-16 code units, 1200 UTF-8 bytes) to defend against the JS `.length` undercount trap.

### 4.3 List-truncation tests (V-09 fix #2)

- `packages/haiku/test/assessments-routes.test.mjs` (DA-04 fixture seeded
  with 2000-char `agent_rationale` and 2000-char `rationale_excerpt`):
  - `"list endpoint truncates agent_rationale to a list-view-safe preview (V-09)"`
  - `"list endpoint truncates per-classification rationale_excerpt (V-09)"`
  - `"list endpoint leaves short rationales untouched (no spurious truncation)"` — protects against an over-eager truncation regression.
  - `"detail endpoint returns FULL agent_rationale + rationale_excerpt — no truncation (V-09)"` — ensures the truncation is presentation-only; the authoritative record is still readable end-to-end.

### 4.4 Suite-wide regression coverage

- The unit's `quality_gates:` frontmatter ends with
  `bun run --cwd packages/haiku test` so the security-reviewer cannot
  green-light this unit on a partial suite. Status at submission:
  **1183 passed, 0 failed across 60 test files**, stable across three
  consecutive runs (verified locally before commit).

## 5. Residual risk

### 5.0 Bolt-3 closure summary

The bolt-1 controls landed the named V-01 / V-02 / V-07 / V-09 fixes but
left an equivalent-class bypass open: `.js` / `.css` / `application/
octet-stream` / unvalidated `attribute_to_user`. Red-team bolt 1
demonstrated end-to-end PoCs (R-01..R-04 in `RED-TEAM-unit-01.md`).
**Bolt 3 closes those gaps in-scope** — see §2 rows for the
equivalent-class extension blocklist additions, the octet-stream
allowlist removal, and the `ATTRIBUTE_TO_USER_PATTERN` bound. The
red-team test `red-team-unit-01-upload-bypass.test.mjs` is now a
regression guard.

### 5.1 Inherited deferrals

The threat-model boundary 4 (serve-back) and the supply-chain regression
dimension (§5 of the threat model) remain. The upload-side allowlist
closes the **primary attack vector** for V-01 / V-02 — bytes that today
would render as `text/html` (or `application/javascript`, or `text/css`)
are refused at boundary 2 and never reach boundary 4. But three
defense-in-depth gaps stay open and are **explicitly accepted** here,
with named target hands-off:

1. **`serveFile`'s MIME map still inline-renders any extension it knows
   about.** If a future patch adds `.xml`/`.xhtml` to `MIME_TYPES`, or
   removes the SVG carve-out, the new renderable extension would convert
   directly into a stored-XSS sink — but only if a corresponding upload
   path also accepts it. This unit's blocklist makes that a two-fault
   regression rather than a one-fault one. **Disposition:** unit-04's
   `ASSESSMENTS.md` MUST file a `stage_revisit` follow-up FB tagged
   "follow-up: serve-side hardening" against a future security iteration.
   Specifically: invert `MIME_TYPES` to "only known-safe types render
   inline; everything else is `application/octet-stream` +
   `Content-Disposition: attachment`" (VULN-REPORT V-01 fix #2). The
   defense-in-depth value is real; the risk without it is bounded by the
   upload-side allowlist landing here.

2. **No CSP on served knowledge / stage-output artifacts.** Any surviving
   inline render (legitimate or attacker-shaped) executes under the tunnel
   origin with full access to the reviewer's session storage and any
   same-origin endpoint. **Disposition:** unit-04 residual risk. Concrete
   proposal: `Content-Security-Policy: default-src 'none'; sandbox;
   frame-ancestors 'none'` on responses from `/files/:sid/...` and
   `/stage-artifacts/:sid/...`. The `sandbox` directive alone closes the
   JWT-exfiltration vector even if the type-aware fix above regresses.
   (VULN-REPORT V-01 fix #3.)

3. **HTML mockups in stage-output are blocked entirely by this unit.**
   The legitimate use-case (designers attach an HTML wireframe to a stage)
   is currently un-served by this unit's allowlist. Reviewers have to
   attach a screenshot or PDF instead. **Disposition:** unit-04 sandboxed
   sub-origin proposal — serve HTML mockups from a distinct origin with
   no JWT in URL and no shared cookies, so an attacker-shaped mockup
   can't reach the tunnel session. Until that ships, the operational
   workaround is "attach a screenshot." The trade-off is conscious —
   feature surface for security surface.

4. **Magic-byte content sniffing on uploads (FB-34).** The
   `ALLOWED_MIMES_*` check at `upload-routes.ts:543-552` (stage-output)
   and `:878-887` (knowledge) compares against `filePart.mimetype` — the
   client-supplied multipart `Content-Type` — and `hasBlockedExtension`
   compares against the client-supplied filename. Neither inspects the
   leading bytes of the streamed payload. An attacker can therefore land
   `<html><script>…</script></html>` bytes on disk by sending them as
   `image/png` with extension `.png`. **Risk bound, NOT zero:**
     - Under normal browser behavior, `serveFile` later sets the response
       `Content-Type` from the extension map at `path-safety.ts:118`, so
       a `.png` GET returns `image/png` and modern browsers refuse to
       render the bytes as HTML — the file shows as a broken image. SAFE
       in the default reviewer browser path.
     - The exposure is in degraded paths: pre-2018 browsers, security
       scanners / image-search bots that "helpfully" re-sniff content
       type, content-detection middleboxes, and any future serve-side
       regression that adds `.bin` or removes the extension-driven
       Content-Type. Combined with the missing
       `X-Content-Type-Options: nosniff` (FB-19) the user-agent has more
       latitude to override the served Content-Type.
     - Same applies to `.json` / `.md` / `.txt` claims — the content can
       still be HTML; the extension-driven Content-Type makes those
       paths render as `text/plain` (no HTML execution) but the audit-
       log surface still ingests attacker-shaped strings.
   **Disposition:** sniff the first 512 bytes against magic numbers for
   the binary-class allowlist members at upload time and 415 on
   mismatch:
     - `image/png` → `89 50 4E 47 0D 0A 1A 0A`
     - `image/jpeg` → `FF D8 FF`
     - `image/gif` → `47 49 46 38 (37|39) 61` (`GIF87a` / `GIF89a`)
     - `image/webp` → `RIFF…WEBP` (4-byte length prefix between)
     - `application/pdf` → `25 50 44 46 2D` (`%PDF-`)
   For text-class members (`text/plain`, `text/markdown`,
   `application/json`) magic-byte sniffing is impractical (no fixed
   prefix); accept on extension+claim and let the serve-side
   Content-Type-from-extension map plus the planned `nosniff` header
   (FB-19) carry the defense. The check belongs after `streamToTempfile`
   completes (the bytes are already on disk in the worktree-staging
   tempfile and a sync read of the first 512 bytes is bounded). The
   `file-type` package (well-audited, single-purpose, ~40 KB minified)
   is the obvious dependency choice; if the team prefers no new dep, a
   hand-rolled magic-byte table for the five binary MIMEs above is < 80
   LOC. **Risk acceptance for now:** the FB-19 `nosniff` header (filed
   for unit-04 serve-side hardening) closes the practical exposure for
   the vast majority of reviewer browsers; the magic-byte upgrade closes
   the equivalent-class regression risk. **`stage_revisit` FB ID:**
   filed as **R-6** in ASSESSMENTS.md, target unit-04 next security
   wave, co-located with R-1 / R-2 serve-side hardening so a single
   wave closes both surfaces.

Two narrower residuals worth recording:

4. **Telemetry-only signal on `cap_clamped`.** When an operator
   misconfigures `HAIKU_UPLOAD_MAX_BYTES` above the hard cap, the clamp
   fires silently from the user's perspective — uploads up to 50 MiB
   succeed; only an OTLP-aware operator sees the event. **Risk bound:**
   the worst case is "the operator's misconfig is ignored instead of
   honoured, and they don't notice." This is the safer failure mode than
   blocking startup or accepting the unbounded value. **Acceptance:**
   intentional. Documented via the `cap_clamped` telemetry event name so
   it's discoverable in the metrics catalog.

5. **Rationale-cap byte counting is UTF-8.** A pathological classification
   with mostly ASCII + one heavy multi-byte cluster could land at 10 KB
   UTF-8 (≈ 5–10 KB of visible characters depending on script). The cap
   is bytes-on-disk, not user-visible characters; that's the correct unit
   for "what the assessments-list endpoint pays for." **Risk bound:** a
   10 KB UTF-8 rationale is at most 10 KB to read back, which is still
   well within the list-view truncation budget (the truncation step trims
   by chars anyway). **Acceptance:** intentional and documented in the
   `state-tools.ts` rationale-cap section comment.

No residual risk in the in-scope V-01 / V-02 / V-07 / V-09 set is accepted
"small risk remains" without naming the concrete bound and target. The
deferrals to unit-02 / unit-03 / unit-04 are inheritances the threat model
already explicitly carries — they are not new gaps opened by this unit.
