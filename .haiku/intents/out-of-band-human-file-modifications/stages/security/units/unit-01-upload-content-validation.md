---
title: >-
  Upload content validation: MIME/extension allowlist + size cap (V-01, V-02,
  V-07, V-09)
depends_on: []
inputs:
  - .haiku/intents/out-of-band-human-file-modifications/knowledge/VULN-REPORT.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/explicit-spa-upload.feature
  - packages/haiku/src/http/upload-routes.ts
  - packages/haiku/src/http/default-routes.ts
  - packages/haiku/src/http/assessments-routes.ts
  - packages/haiku/src/http/path-safety.ts
outputs:
  - stages/security/artifacts/THREAT-MODEL-unit-01.md
  - stages/security/artifacts/SECURITY-CONTROLS-unit-01.md
  - packages/haiku/src/http/assessments-routes.ts
  - packages/haiku/src/http/upload-routes.ts
  - packages/haiku/src/orchestrator/workflow/handlers/gate.ts
  - packages/haiku/src/state-tools.ts
  - packages/haiku/src/tools/orchestrator/haiku_classify_drift.ts
  - packages/haiku/test/assessments-routes.test.mjs
  - packages/haiku/test/state-tools-handlers.test.mjs
  - packages/haiku/test/upload-routes.test.mjs
  - stages/security/artifacts/RED-TEAM-unit-01.md
  - packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs
model: opus
quality_gates:
  - name: v01-v02-allowed-mimes-defined
    command: >-
      grep -qE 'ALLOWED_MIMES|allowedMimes|MIME_ALLOWLIST'
      packages/haiku/src/http/upload-routes.ts
  - name: v01-v02-html-extension-rejected-test-named
    command: >-
      grep -qE 'rejects.*\.html|html.*rejected|text/html.*415'
      packages/haiku/test/upload-routes.test.mjs
  - name: v07-upload-max-bytes-hard-cap
    command: >-
      grep -qE
      'MAX_UPLOAD_BYTES_HARD_CAP|Math\.min.*HAIKU_UPLOAD_MAX_BYTES|uploadHardCap'
      packages/haiku/src/http/upload-routes.ts
  - name: v07-oversize-clamp-test-named
    command: >-
      grep -qE
      'clamps.*oversize|HAIKU_UPLOAD_MAX_BYTES.*clamp|hard.*cap.*upload'
      packages/haiku/test/upload-routes.test.mjs
  - name: v09-rationale-cap-10kb-and-excerpt-cap-1kb
    command: >-
      bash -c 'grep -qE
      "agent_rationale.*10\\s*\\*\\s*1024|10240|MAX_RATIONALE_BYTES"
      packages/haiku/src/state-tools.ts && grep -qE
      "rationale_excerpt.*1024|MAX_RATIONALE_EXCERPT_BYTES"
      packages/haiku/src/state-tools.ts'
  - name: v09-list-endpoint-truncates-rationale
    command: >-
      grep -qE
      'truncate.*rationale|rationale.*truncate|listView.*rationale|TRUNCATE_RATIONALE'
      packages/haiku/src/http/assessments-routes.ts
  - name: v09-rationale-too-long-test-named
    command: >-
      grep -qE
      'rationale.*too.*long|rationale.*over.*KB.*reject|agent_rationale.*reject'
      packages/haiku/test/state-tools-handlers.test.mjs
  - name: haiku-suite-passes
    command: bun run --cwd packages/haiku test
status: completed
bolt: 4
hat: blue-team
started_at: '2026-05-03T02:09:52Z'
hat_started_at: '2026-05-03T08:48:25Z'
iterations:
  - hat: threat-modeler
    started_at: '2026-05-03T02:09:52Z'
    completed_at: '2026-05-03T02:13:30Z'
    result: advance
  - hat: security-engineer
    started_at: '2026-05-03T02:13:30Z'
    completed_at: '2026-05-03T02:43:45Z'
    result: advance
  - hat: security-reviewer
    started_at: '2026-05-03T02:43:45Z'
    completed_at: '2026-05-03T02:50:02Z'
    result: advance
  - hat: red-team
    started_at: '2026-05-03T02:50:02Z'
    completed_at: '2026-05-03T02:58:55Z'
    result: reject
    reason: >-
      Red-team found 4 unclosed findings (2 HIGH, 1 MED, 1 LOW). The V-01/V-02
      BLOCKED_EXTENSIONS list (.html/.htm/.svg/.xml/.xhtml/.mhtml) misses .js
      and .css — combined with application/octet-stream on ALLOWED_MIMES_*, the
      same stored-XSS threat model is reachable just by trading file extensions.
      PoC test (packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs)
      executes end-to-end against the live HTTP route and demonstrates 200 OK
      for pwn.js + pwn.css uploads via octet-stream. R-03: text/markdown MIME
      with .js extension also bypasses (asymmetric MIME-spoof defence). R-04:
      attribute_to_user is unvalidated and persists verbatim in audit-log,
      enabling Reflected-Stored XSS hybrid via any SPA log-rendering view. All
      four findings filed as FB-01/02/03/04 against the security stage with
      reproducible PoCs and recommended fixes. Full red-team report at
      stages/security/artifacts/RED-TEAM-unit-01.md.
  - hat: security-reviewer
    started_at: '2026-05-03T02:58:55Z'
    completed_at: '2026-05-03T08:01:00Z'
    result: reject
    reason: >-
      REJECT — security-engineer controls do not address the threat class the
      threat-modeler identified.


      Failed criteria (security-reviewer mandate):

      - Check #2 (every threat-modeler threat is accounted for): The
      threat-modeler called out HIGH "Knowledge XSS via served file in tunnel
      origin" (V-01) and HIGH "Stage-output XSS same class" (V-02). The controls
      artifact (SECURITY-CONTROLS-unit-01.md §2 rows 1-2) claims these are
      closed by `BLOCKED_EXTENSIONS = {.html,.htm,.svg,.xml,.xhtml,.mhtml}` plus
      per-route MIME allowlists. Red-team bolt 1 proved this claim false with
      end-to-end PoCs
      (packages/haiku/test/red-team-unit-01-upload-bypass.test.mjs):
        - R-01 (HIGH, FB-01): `.js` upload with `application/octet-stream` MIME slips the allowlist (octet-stream is on ALLOWED_MIMES_KNOWLEDGE/STAGE_OUTPUT, .js is not in BLOCKED_EXTENSIONS). Served back with `Content-Type: application/javascript` per path-safety.ts:20. Same XSS-in-tunnel-origin threat the modeler rated HIGH.
        - R-02 (HIGH, FB-02): `.css` same bypass mechanism (.css → text/css in MIME map at path-safety.ts:19). Threat-modeler enumerated `.html/.htm/.xhtml/.mhtml/.svg/.xml`; .js/.css are equivalent vectors for the same threat class but are not blocked.
        - R-03 (MED, FB-03): `application/octet-stream` on both ALLOWED_MIMES sets makes the MIME allowlist effectively a no-op for any extension not in BLOCKED_EXTENSIONS.
        - R-04 (LOW, FB-04): `attribute_to_user` written verbatim to action-log/write-audit JSONL — stored-XSS vector for any future SPA log renderer.

      The threat-modeler's threat is "stored XSS via served file in tunnel
      origin," not literally "exactly six file extensions." Closing six named
      extensions while leaving equivalent-class .js/.css open does not
      substantively address the threat — it is silent omission of the threat
      class, which the security-reviewer mandate calls a hard reject.


      - Check #6 (residual risk is specific): SECURITY-CONTROLS-unit-01.md §5
      enumerates 5 residuals (serveFile MIME-map inversion, no CSP, no sandboxed
      origin, telemetry-only clamp signal, UTF-8 byte counting). It does NOT
      acknowledge the .js/.css/octet-stream bypass class or the unvalidated
      `attribute_to_user` vector. The artifact is silent on the gaps red-team
      enumerated — neither closed in §2, nor documented in §5.


      What the next security-engineer bolt MUST land before returning to
      security-reviewer:

      1. Add `.js`, `.css`, `.htc`, `.hta`, `.htaccess` to BLOCKED_EXTENSIONS
      (closes R-01/R-02 directly). Update the V-01/V-02 row evidence in
      SECURITY-CONTROLS-unit-01.md §2 + add tests in upload-routes.test.mjs that
      the .js and .css uploads are rejected with 415.

      2. Remove `application/octet-stream` from both ALLOWED_MIMES_STAGE_OUTPUT
      and ALLOWED_MIMES_KNOWLEDGE (closes R-03 — restores the allowlist's stated
      purpose). Update the controls artifact and add a test that octet-stream
      upload is rejected.

      3. Validate `attribute_to_user` at upload time with a bounded slug pattern
      (e.g. `^[\w][\w\-.@ ]{0,127}$`); reject 400 with `bad_attribute_to_user`
      (closes R-04). Add a row in SECURITY-CONTROLS-unit-01.md §2 mapping the
      audit-log poisoning threat to this control + test.

      4. Mark FB-01/FB-02/FB-03/FB-04 as closed via the fix-loop hat dispatch.
      Open FBs at status `fixing` cannot be left for the next bolt.


      Until the controls artifact body shows either the bypass class closed
      (with impl + test references) or explicitly accepted in §5 with concrete
      bound + named target (the latter is unacceptable for HIGH-severity
      threats), security-reviewer cannot advance.
  - hat: security-engineer
    started_at: '2026-05-03T08:01:00Z'
    completed_at: '2026-05-03T08:26:00Z'
    result: advance
  - hat: security-reviewer
    started_at: '2026-05-03T08:26:00Z'
    completed_at: '2026-05-03T08:28:13Z'
    result: reject
    reason: >-
      REJECT — artifact substance is now correct (SECURITY-CONTROLS-unit-01.md
      §2 closes R-01/R-02/R-03/R-04 with impl + test refs, §5.0 records the
      bolt-3 closure), BUT the prior rejection's hard requirement #4 is still
      unmet: FB-01/FB-02/FB-03/FB-04 remain at status `fixing`. The prior
      reviewer explicitly stated "Mark FB-01/FB-02/FB-03/FB-04 as closed via the
      fix-loop hat dispatch. Open FBs at status `fixing` cannot be left for the
      next bolt." Per the prompt's "Treat each item as a hard requirement"
      instruction, this hat cannot advance while those FBs remain open.


      What's outstanding (security-engineer bolt 4 must close):

      1. FB-01 (R-01 .js bypass) — code is fixed, FB needs to be closed via
      fix-loop hat dispatch (haiku_feedback_advance_hat through the fix_hats
      sequence ending at feedback-assessor).

      2. FB-02 (R-02 .css bypass) — same as FB-01.

      3. FB-03 (R-03 octet-stream allowlist no-op) — same.

      4. FB-04 (R-04 attribute_to_user XSS) — same.


      Note: FB-05 ("V-11 baseline gate bypassable via state.json tamper") is
      out-of-scope for unit-01 (which closes V-01/V-02/V-07/V-09 only). It
      belongs against a different unit/stage. Move it via haiku_feedback_move to
      the appropriate target rather than blocking this unit on it.


      Code-side verdict: PASS (would advance if FBs were closed). Body
      verification:

      - Check #1 (surface scope concrete and bounded): PASS — §1 names two
      routes with clear boundaries.

      - Check #2 (every threat-modeler threat accounted for): PASS — §2 maps
      every threat from THREAT-MODEL-unit-01.md §4/§8, including the
      equivalent-class extensions (.js/.mjs/.cjs/.css/.htc/.hta/.htaccess),
      octet-stream allowlist removal, and attribute_to_user bound.
      Implementation in upload-routes.ts:122-138 (BLOCKED_EXTENSIONS), :149-172
      (ALLOWED_MIMES_*), :188-199
      (ATTRIBUTE_TO_USER_PATTERN/isValidAttributeToUser) confirms the claims.

      - Check #3 (controls cite real implementation references): PASS — §3 cites
      specific functions, constants, and ordered handler steps that match the
      source.

      - Check #4 (controls cite tests OR note gaps): PASS — §4 cites named tests
      in upload-routes.test.mjs, red-team-unit-01-upload-bypass.test.mjs,
      state-tools-handlers.test.mjs, assessments-routes.test.mjs.

      - Check #5 (decision-register consistency): PASS — no contradictions.

      - Check #6 (residual risk specific): PASS — §5.1 enumerates concrete
      residuals with named targets (unit-04 follow-up FB, CSP proposal,
      sandboxed sub-origin) and explicit acceptance rationale for telemetry-only
      clamp signal and UTF-8 byte counting.


      The blocker is purely the FB-lifecycle requirement carried forward from
      the prior rejection.
  - hat: security-engineer
    started_at: '2026-05-03T08:28:13Z'
    completed_at: '2026-05-03T08:32:07Z'
    result: advance
  - hat: security-reviewer
    started_at: '2026-05-03T08:32:07Z'
    completed_at: '2026-05-03T08:36:37Z'
    result: advance
  - hat: red-team
    started_at: '2026-05-03T08:36:37Z'
    completed_at: '2026-05-03T08:48:25Z'
    result: advance
  - hat: blue-team
    started_at: '2026-05-03T08:48:25Z'
    completed_at: '2026-05-03T08:51:24Z'
    result: advance
model_original: sonnet
completed_at: '2026-05-03T08:51:24Z'
---
# Unit 01 — Upload content validation

## Scope

Close four vuln-report findings about the SPA upload paths in `packages/haiku/src/http/upload-routes.ts`:

- **V-01 (HIGH)** stored XSS via `/api/intents/:intent/uploads/knowledge` — `.html` upload renders inline because `serveFile`'s MIME map matches HTML.
- **V-02 (HIGH)** same class on `/api/intents/:intent/uploads/stage-output`.
- **V-07 (MED)** `HAIKU_UPLOAD_MAX_BYTES` has no upper bound — a misconfigured 10GB env value combined with sync SHA-256 in the drift gate stalls the workflow tick.
- **V-09 (LOW)** unbounded `agent_rationale` AND `rationale_excerpt` writes bloat `DA-NN.json`; the assessments-list endpoint reads them all back unsummarized.

## Approach

1. **MIME/extension allowlist** (V-01, V-02): define per-route `ALLOWED_MIMES` constants in `upload-routes.ts`. Reject everything else with 415 before writing. Reject `.html`, `.htm`, `.svg`, `.xml`, `.xhtml`, `.mhtml` extensions explicitly even when MIME spoofs.
2. **Hard cap on upload size** (V-07): `MAX_UPLOAD_BYTES_HARD_CAP = 50 * 1024 * 1024` (50 MB). Effective cap = `Math.min(envValue, MAX_UPLOAD_BYTES_HARD_CAP)`. Log clamp event to telemetry when env exceeds cap.
3. **Rationale schema caps** (V-09 fix #1): in `haiku_classify_drift` (state-tools.ts), reject `agent_rationale > 10 KB` and per-classification `rationale_excerpt > 1 KB` at schema-validation time with `agent_rationale_too_long` / `rationale_excerpt_too_long` structured errors. The 10 KB/1 KB sizes match the report's recommendation.
4. **List-endpoint truncation** (V-09 fix #2): in `assessments-routes.ts` list handler, truncate `agent_rationale` and `rationale_excerpt` to a list-view-safe length (256 chars + `…`); return full fields only on per-id detail endpoint.

## Out of scope (deferred to unit-04 ASSESSMENTS.md residual risk)

- Inverting `serveFile`'s MIME map to "only known-safe types render inline; everything else is `application/octet-stream` + `Content-Disposition: attachment`" (VULN-REPORT V-01 fix #2).
- Adding `Content-Security-Policy: default-src 'none'; sandbox; frame-ancestors 'none'` headers on served knowledge artifacts (V-01 fix #3).
- Sandboxed sub-origin for stage-output HTML mockups (V-02).

These serve-side defenses are real defense-in-depth gaps but the upload-side allowlist closes the primary attack vector. Unit-04's ASSESSMENTS.md MUST file a `stage_revisit` FB tagged "follow-up: serve-side hardening" against a future security iteration.

## Completion criteria

- `packages/haiku/src/http/upload-routes.ts` defines `ALLOWED_MIMES` per route + extension blocklist.
- `MAX_UPLOAD_BYTES_HARD_CAP` constant defined; effective cap clamps env values via `Math.min`.
- `agent_rationale` and `rationale_excerpt` rejected at schema-validation time with structured errors per the byte caps above.
- `assessments-routes.ts` list handler truncates both rationale fields.
- New tests in `packages/haiku/test/upload-routes.test.mjs` cover: HTML upload rejected (415), oversize upload clamped, MIME spoof rejected.
- New tests in `packages/haiku/test/state-tools-handlers.test.mjs` cover: rationale-too-long structured error.
- Full `bun run --cwd packages/haiku test` passes.

## References

- VULN-REPORT.md V-01, V-02, V-07, V-09
- `packages/haiku/src/http/upload-routes.ts`, `assessments-routes.ts`, `path-safety.ts`
- `packages/haiku/src/state-tools.ts` (haiku_classify_drift schema)
- `packages/haiku/test/upload-routes.test.mjs`, `state-tools-handlers.test.mjs`
