# Threat Model — unit-01 Upload Content Validation

**Surface scope (one paragraph).** The two SPA upload routes that accept
human-authored bytes into the intent directory:
`POST /api/intents/:intent/uploads/knowledge` and
`POST /api/intents/:intent/uploads/stage-output`
(`packages/haiku/src/http/upload-routes.ts:227-733`); the per-tick
synchronous SHA-256 of every tracked file consumed by the drift gate
(`drift-detection-gate.ts:561-571` → `drift-baseline.ts:471-485`); and
the persisted Assessment records produced by `haiku_classify_drift` plus
the SPA list endpoint that reads them all back
(`haiku_classify_drift.ts:546-567`, `assessments-routes.ts:206-213`).
This unit closes V-01, V-02, V-07, V-09 from VULN-REPORT.md — it does
NOT cover author-identity binding (V-03, V-08, unit-02), TOCTOU on
intermediate dirs (V-04, V-08, unit-03), or assessment-record provenance
(unit-04). Trust boundary assumed: tunnel mode (the higher-risk context
where these routes face the public localtunnel URL behind an HS256 JWT).

## 1. Asset inventory (what's being defended)

| Asset | Where it lives | Why an attacker wants it |
|---|---|---|
| Reviewer browser DOM in tunnel origin | served back from `/files/:sid/...` and `/stage-artifacts/:sid/...` | Steals the active tunnel JWT (URL-bound `?t=...`), exfiltrates intent state, mints follow-up writes as the reviewer |
| Workflow tick liveness | `runWorkflowTick` → drift gate → `computeFileSha256Sync` | DoS — every blocked tick blocks every advance; a multi-GB tracked file blocks the engine for seconds-to-minutes per tick |
| Intent disk capacity | `.haiku/intents/<slug>/` filesystem | DoS by storage exhaustion; rename-into-place is irreversible once it lands |
| Assessment record fidelity | `stages/{stage}/drift-assessments/DA-NN.json` + the SPA list view | Reviewer cannot triage drift if every record is megabytes of attacker-controlled rationale; server OOMs on list call |
| Audit-trail provenance | `write-audit.jsonl` + `action-log.jsonl` | Out-of-scope for this unit (V-03 in unit-02), but downstream of the same upload calls — flagged so unit-02 inherits the trust boundary cleanly |

## 2. Trust boundaries (where trusted bytes become untrusted)

This is the load-bearing diagram for every threat below.

```
                       ╔══════ TRUST BOUNDARY 1: tunnel edge ══════╗
                       ║                                           ║
[browser / curl]──HTTPS══>[tunnel URL]──>[fastify]──>[upload-routes.ts]
                                          │              │
   JWT in ?t= or Bearer ──> requireTunnelAuth ──> {intent slug, sid}
                                                         │
                       ╔══════ TRUST BOUNDARY 2: bytes-on-disk ════╗
                       ║                                           ║
   multipart filePart ─stream─> tempfile ─rename─> .haiku/intents/<slug>/...
                                                         │
                       ╔══════ TRUST BOUNDARY 3: tick read-back ═══╗
                       ║                                           ║
   next haiku_run_next ──> drift gate ──> readdir + SHA-256 every tracked file
                                          │
                                          └──> action-log + classify_drift
                                                         │
                       ╔══════ TRUST BOUNDARY 4: serve-back ═══════╗
                       ║                                           ║
   reviewer GET /files/<sid>/knowledge/foo.html ──> serveFile ──> browser
                                                         │
                                          MIME_TYPES[".html"] = "text/html; charset=utf-8"
```

**Boundary 1 (tunnel edge).** Anything past `requireTunnelAuth` is
treated by upload-routes.ts as a holder of a session-bound JWT for the
named intent. That is the *only* identity claim. There is no further
correlation to a specific reviewer (V-03 territory — unit-02), no
content-type check (V-01/V-02 — this unit), no cap on the env-tunable
size limit (V-07 — this unit).

**Boundary 2 (bytes-on-disk).** The route streams to a tempfile,
SHA-256s it, then renames into place. After the rename, the file is
indistinguishable from any other file in the intent dir. The drift gate
will hash it, the action-log will record it as `human-via-mcp`, and the
file-serve routes will serve it. No content-type signal survives the
boundary — the bytes ARE the artifact.

**Boundary 3 (tick read-back).** Every tracked file is hashed
synchronously inside the workflow tick (`computeFileSha256Sync`). Bytes
that crossed boundary 2 untyped become workload that the workflow tick
must process before any other action can run. Size of input here is
attacker-controlled when boundary 1 is loose (V-07).

**Boundary 4 (serve-back).** `serveFile` consults `MIME_TYPES` purely
on extension. `.html` → `text/html` and inline render. The SVG carve-out
(force `application/octet-stream` + `Content-Disposition: attachment`)
is the *only* type-aware defense on this path. Every other extension
mapped in `MIME_TYPES` is an XSS sink if attacker-controlled bytes
landed at boundary 2.

## 3. Threat actors

Not just "external attacker." The hat MUST consider all three.

| Actor | Capability assumed | Why they care about this surface |
|---|---|---|
| **External, unauthenticated** | Knows the public tunnel URL but no JWT | Phishing for a leaked `?t=...` link; opportunistic CSRF (V-08, unit-03) — out of scope here but flagged |
| **External, JWT-bearing** | Has a leaked tunnel JWT (Slack paste, screenshot, accidental commit) | Plant XSS in knowledge/stage-output to escalate to full reviewer-tab takeover next time the legitimate reviewer visits — V-01, V-02 |
| **Misconfigured operator** | Sets `HAIKU_UPLOAD_MAX_BYTES=10737418240` (extra zero) at startup | Not malicious, but lifts the safety net on every other defense. Single upload then exhausts disk and stalls the workflow tick — V-07 |
| **Compromised / hostile agent** | Owns the MCP session; calls `haiku_classify_drift` with attacker-shaped inputs | Bloats `DA-NN.json` and the assessments-list response unboundedly — V-09. Does NOT need network access; the threat lives entirely on the agent side of trust boundary 0 |
| **Insider reviewer** | Holds a legitimate JWT but has malicious intent | Same primitive as external JWT-bearing — `attribute_to_user` is unverified (V-03, unit-02) so they can pin authorship on a colleague while planting the payload |
| **Supply-chain regression** | Future change to `MIME_TYPES` or `serveFile` adds a new renderable type, or removes the SVG carve-out | The current upload-side has no allowlist, so any serve-side regression converts directly into stored XSS. The architectural fix in this unit (allowlist at upload) is what makes serve-side hardening a defense-in-depth question rather than a single point of failure |

## 4. STRIDE — per data flow

### 4.1 Knowledge upload flow (`POST /uploads/knowledge`)

| STRIDE | Threat | Severity | Notes |
|---|---|---|---|
| **S**poofing | Caller spoofs identity via `attribute_to_user` (free-form multipart string) | High | V-03 — out of scope here, **explicitly handed to unit-02**. Flagged so unit-02 doesn't miss the dependency |
| **T**ampering | Caller uploads `.html`/`.htm`/`.xhtml`/`.mhtml`/`.svg`/`.xml` payload that, served back via `/files/:sid/...`, executes script in the tunnel origin | **HIGH (V-01)** | Primary in-scope threat. Root cause: no MIME/extension allowlist at upload time. Boundary-2 untyped → boundary-4 inline render |
| **T**ampering (variant) | MIME spoof: caller sets `Content-Type: image/png` on a multipart part whose payload is `<script>...`, names it `xss.png` to slip past extension check | Med | If the fix is "trust the multipart MIME header," this variant lands. The fix MUST be: allowlist BOTH the `target_filename` extension AND the multipart `mimetype`, AND reject any extension in the renderable-HTML set even if MIME claims otherwise |
| **R**epudiation | Author-id forgery makes audit trail useless | Med | V-03, unit-02 |
| **I**nformation disclosure | Stored XSS exfiltrates the reviewer's JWT (`?t=...` is in document.URL), other intent state via `fetch('/api/feedback-intent/...')` | High | Direct consequence of T above — this is what makes the V-01 fix so important |
| **D**enial of service | No upper bound on `HAIKU_UPLOAD_MAX_BYTES` → multi-GB upload exhausts disk; same upload then stalls drift-gate's sync SHA-256 every tick | **MED (V-07)** | In-scope. Two-stage damage: storage exhaustion at write time; tick liveness exhaustion at read time |
| **E**levation of privilege | XSS in tunnel origin can call any SPA-callable endpoint as the reviewer (mint feedback, classify drift, upload more) | High | Cascade of T+I above. Containment: the XSS fix above closes this; defense-in-depth (CSP, sandboxed origin) is deferred to unit-04's residual-risk register |

### 4.2 Stage-output upload flow (`POST /uploads/stage-output`)

Same STRIDE matrix as 4.1 with two deltas worth calling out:

- **T (HIGH, V-02).** Same root cause as V-01, but the threat envelope
  is louder because stage-output is *explicitly* the surface where
  reviewers swap in figma/HTML/image artifacts mid-review. Hostile
  uploads are inside the legitimate use-case. The fix MUST NOT make
  legitimate HTML mockups un-uploadable — the deferred mitigation in
  unit-04 (sandboxed sub-origin for HTML mockups) is what restores that
  capability after this unit ships the upload-side allowlist.
- **T (Med, target_path).** `target_path` accepts a slash-bearing
  relative path (must canonicalise under `stages/{stage}/artifacts/`).
  The basename traversal patterns (`..`, `\x00`, `\\`) are rejected.
  Extension blocklist MUST apply to the *final* basename after
  canonicalization, not the raw `target_path`, or `evil/innocent.html`
  slips through if the agent only checks `path.endsWith()`.

### 4.3 Drift gate read-back flow (cascaded from 4.1/4.2)

| STRIDE | Threat | Severity | Notes |
|---|---|---|---|
| **D**oS | Sync SHA-256 of N-GB files runs in the tick path; every tick stalls for the duration | **MED (V-07 cascade)** | The hard cap on `HAIKU_UPLOAD_MAX_BYTES` is what makes this bounded. The unit spec's cap of 50 MB matches the default and bounds tick latency to single-digit seconds at worst |
| **T**ampering | Out of scope for this unit (V-04 — TOCTOU on intermediate dirs, unit-03) | — | Flagged for boundary inheritance |

### 4.4 Assessments persistence flow (`haiku_classify_drift` → DA-NN.json → list)

| STRIDE | Threat | Severity | Notes |
|---|---|---|---|
| **D**oS — disk | Hostile/buggy agent writes 10 MB+ `agent_rationale` per classification; with N classifications per assessment and M assessments per stage, the stage's `drift-assessments/` grows without bound | **LOW (V-09)** | In-scope. Schema-level cap (10 KB on `agent_rationale`, 1 KB on per-classification `rationale_excerpt`) refuses the bytes at the boundary. Caps match VULN-REPORT.md §V-09 recommended fix |
| **D**oS — RAM/bandwidth | List endpoint reads every assessment file fully into memory, returns the full payload to the SPA | **LOW (V-09 cascade)** | List handler MUST truncate `agent_rationale` and `rationale_excerpt` to a short preview (256 chars + ellipsis) and link to the per-id detail endpoint for the full record |
| **R**epudiation | Truncation-vs-full asymmetry makes the list view a different document from the detail view | Low | Acceptable: the truncated preview is a list-view convention, not a tamper. The detail endpoint is the authoritative read |
| **T**ampering | Agent injects malformed UTF-8 / control chars into rationale to confuse the SPA renderer | Low | Bounded by markdown sanitization on the SPA renderer side (V-10 territory, deferred). The byte-cap refuses egregious payloads but is not a sanitizer |

### 4.5 Internal-service flow: upload-route → drift-gate → assessments

This is the data flow that the threat-modeler MUST NOT skip
(anti-pattern: "ignore data flows between internal services").

```
upload-routes.ts  ──>  filesystem  ──>  drift-detection-gate.ts  ──>  haiku_classify_drift  ──>  DA-NN.json  ──>  assessments-routes.ts  ──>  SPA
                                            │                            │                                          │
                                            └─sync SHA on every tick     └─unbounded rationale write                └─unbounded list-read
                                              (V-07)                       (V-09 fix #1)                              (V-09 fix #2)
```

Every defense in this unit shifts work *earlier* in the pipeline so a
single boundary refusal closes downstream cascades. The hard cap on
upload size bounds drift-gate hash latency. The schema cap on rationale
size bounds disk growth bounds list-endpoint memory. This is the load-
bearing reason the unit is structured as four targeted boundary fixes
rather than four independent patches.

## 5. Insider / supply-chain dimension (anti-pattern guard)

The hat **MUST NOT** only model external threats. Two non-external
threats matter to this surface:

1. **Hostile-agent (insider on the trust-0 side).** The MCP session is
   a long-lived, fully-trusted writer. `haiku_classify_drift` accepts
   agent-supplied `agent_rationale` with no length cap (V-09). A
   mis-prompted agent (or a compromised one in a future model release)
   can fill disk and RAM without ever crossing the tunnel boundary.
   This is in scope for this unit's V-09 fix — schema-level rejection
   bounds the blast radius regardless of agent posture.
2. **Supply-chain regression on `MIME_TYPES` / `serveFile`.** Today
   `.svg` is force-downloaded; `.html` is rendered. A future change
   that adds `.xml`, `.xhtml`, or a new renderable type (or that
   accidentally drops the SVG carve-out) converts directly into stored
   XSS via the existing knowledge/stage-output uploads — there is no
   second line of defense at upload time. This is exactly the
   architectural reason V-01/V-02's primary fix is at the upload
   boundary, not at the serve boundary: upload-side allowlist makes
   serve-side a defense-in-depth question, not a single point of
   failure. The deferred fixes in unit-04 (invert serveFile MIME map,
   add CSP, sandboxed sub-origin) are the second layer.

## 6. Severity calls (the hard ones)

The hat **MUST NOT** rate everything as "medium" to avoid making hard
calls. Explicit severity decisions for this unit:

- **HIGH (V-01, V-02).** Stored XSS in the tunnel origin reads the
  reviewer's JWT (URL-bound) and lets the attacker mint follow-up
  writes as that reviewer. This is a full session-takeover primitive
  reachable from a multipart POST with an extension-spoofed file. No
  ambiguity — High.
- **MED (V-07).** Operator misconfiguration (one extra zero) lifts the
  cap. Damage is real (disk exhaustion + tick stall) but requires the
  operator-level mistake first. Not High because attacker doesn't
  control the trigger; not Low because the consequence is workflow-
  wide DoS that cascades to every drift-gate tick.
- **LOW (V-09).** Agent writes unbounded rationale. Hostile-agent
  threat model. Damage is bounded by disk size; no privilege
  escalation, no XSS, no network exfiltration. Low is correct here —
  the fix is cheap and worth doing for hygiene, not because it's
  load-bearing.

## 7. Threats explicitly out of scope (handed to siblings)

Recorded so the security-engineer hat doesn't try to address them
inside this unit — and so unit-04's residual-risk register inherits
them cleanly:

- **V-03 author-identity forgery on `attribute_to_user`** → **unit-02**.
  Cross-references the same upload routes; unit-01's MIME/size fixes
  do not depend on unit-02's identity binding (and vice versa).
- **V-04 TOCTOU on intermediate parent dirs** → **unit-03**.
- **V-08 CSRF on mutating routes via `?t=` query token** → **unit-03**.
- **Serve-side hardening (V-01 fix #2/#3, V-02 sandboxed sub-origin)**
  → **unit-04 ASSESSMENTS.md residual-risk register**, with a tagged
  `stage_revisit` follow-up FB filed against a future security
  iteration.

## 8. What the security-engineer hat MUST address

Mapping from this threat model to the controls the next hat must put
in place. Every threat above gets one of: **control in this unit**,
**control deferred (named target)**, **explicit residual-risk
acceptance**.

| Threat | Disposition | Where |
|---|---|---|
| Knowledge XSS via `.html`/`.htm`/`.xhtml`/`.mhtml`/`.svg`/`.xml` (V-01) | Control in this unit | `upload-routes.ts` — `ALLOWED_MIMES` per-route + extension blocklist applied to the **final basename** (after canonicalisation) **and** the multipart `mimetype` |
| Stage-output XSS same class (V-02) | Control in this unit | Same `ALLOWED_MIMES` mechanism on the stage-output route; basename is taken from the canonicalised `target_path` |
| MIME spoof (renderable extension claims `image/png`) | Control in this unit | Reject when extension is in the renderable-HTML/script set, regardless of multipart MIME |
| Operator misconfig of `HAIKU_UPLOAD_MAX_BYTES` (V-07) | Control in this unit | `MAX_UPLOAD_BYTES_HARD_CAP = 50 * 1024 * 1024`; effective cap = `Math.min(envValue, MAX_UPLOAD_BYTES_HARD_CAP)`; emit a clamp-event telemetry line at startup when env exceeds cap |
| Drift-gate sync-SHA stall on big files (V-07 cascade) | Control via above | The hard cap bounds file size, which bounds hash latency. No additional control needed in this unit; deeper async-hash work is deferred |
| Unbounded `agent_rationale` write (V-09 fix #1) | Control in this unit | Schema-level reject: `agent_rationale > 10 KB` returns `agent_rationale_too_long`; per-classification `rationale_excerpt > 1 KB` returns `rationale_excerpt_too_long`. Both as structured errors |
| Unbounded list-endpoint read (V-09 fix #2) | Control in this unit | `assessments-routes.ts` list handler truncates `agent_rationale` and `rationale_excerpt` to 256 chars + `…`; full fields only on per-id detail endpoint |
| Author-id spoofing (V-03) | Deferred — unit-02 | Cross-reference flagged; unit-02 must derive `human_author_id` from JWT `sid` |
| TOCTOU on intermediate dirs (V-04), CSRF (V-08) | Deferred — unit-03 | Flagged; unit-03 hardens the upload-routes auth + atomicity layer |
| Serve-side: invert MIME map; CSP on knowledge artifacts; sandboxed origin for HTML mockups | Deferred — unit-04 residual risk | Defense-in-depth gaps. The upload-side allowlist closes the primary vector; these close the regression-resilience gap |
| Markdown body sanitization on agent-authored feedback (V-10) | Out of scope for this unit | Not in V-01/V-02/V-07/V-09; flagged so unit-04 picks it up |

This threat model is the contract the security-engineer hat verifies
against. Any threat above without a disposition is a verification
failure.
