# Security Assessment — Unit 02 (Author Identity Binding + Status-Check Correctness)

Implementer-hat output for unit-02. Closes V-03, V-05, V-06 from
`knowledge/VULN-REPORT.md`. The threat-model artifact (sibling
`THREAT-MODEL-unit-02.md`) drove the acceptance criteria; this artifact
records the controls that were landed and the residual risk that
remains. Written to the format the security-reviewer expects (surface
scope · threat coverage · implementation refs · test refs · residual
risk).

---

## 1. Surface scope

The three out-of-band-modification surfaces this unit hardens:

- **SPA upload routes** — `POST /api/intents/:intent/uploads/stage-output`
  and `POST /api/intents/:intent/uploads/knowledge`
  (`packages/haiku/src/http/upload-routes.ts`). Trust boundary: tunnel-
  mode JWT-bearer reviewer ↔ MCP server. Trusted-tunnel-bearer can
  upload arbitrary attribution claims and arbitrary status YAML that
  the previous substring scan would mis-classify.
- **Conversational MCP write** — `haiku_human_write` tool
  (`packages/haiku/src/tools/orchestrator/haiku_human_write.ts`).
  Trust boundary: trusted-but-honest agent ↔ MCP server. Agent supplies
  attribution self-reportedly; the audit log is the only durable
  record of "who".
- **Drift-detection-gate consumer** —
  `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts`.
  Reads `action-log.jsonl` to attribute file changes as
  `human-via-mcp` vs `human-implicit`. Mis-attribution cascades to
  Assessment record integrity (`haiku_classify_drift.ts`).

Data classes handled: file content (arbitrary bytes), attribution
identifiers (free-text strings, recorded as claims), tick counters
(integer monotonic), intent state (frontmatter parse).

---

## 2. Threat coverage

Per-finding table mapping the threat-modeler's threats to landed
controls and regression tests.

### V-03 — Self-reported `human_author_id` poisoned the audit trail

| Threat | Control landed | Test |
|---|---|---|
| Spoofing (S) — JWT-bearer reviewer posts `attribute_to_user=ceo@company.com` | Field RENAMED to `claimed_author_id` everywhere it is persisted (`write-audit.jsonl`, `action-log.jsonl`, MCP-tool response, MCP-tool input schema). Consumers MUST treat it as a CLAIM, not an authority. Schema description carries the "self-reported / not validated" callout reframed as "this is a claim, not an identity". | `state-tools-handlers.test.mjs::haiku_human_write accepts claimed_author_id and persists it...`, `upload-routes.test.mjs::V-03: stage-output upload writes claimed_author_id AND human_author_id (legacy alias)`, `upload-routes.test.mjs::V-03: knowledge upload writes claimed_author_id...` |
| Repudiation (R) — reviewer denies they uploaded | Mitigated by transparency. `claimed_author_id` is explicitly non-repudiation-bearing — the audit log surfaces "this is what the caller said" so reviewers triaging an incident don't take the field as authoritative. Strong non-repudiation requires Option A (server-resolved identity) — DEFERRED. | `state-tools-handlers.test.mjs::readClaimedAuthorId prefers claimed_author_id over human_author_id` (consumer behaviour pinned). |
| Information disclosure (I) — forged identity surfaces in feedback / audit UIs | Mitigated by rename. UI surfaces (and audit-log readers) MUST treat the renamed field as a claim. (Reader-side rename in haiku-ui is OUT OF SCOPE for this unit — server stops promoting the field as authoritative; UI follow-up tracked in residual risk §5.) | n/a — server-side coverage only |
| Tampering (T) — past audit lines remain spoofable | NOT addressed here. Requires audit-log hash-chaining (VULN-REPORT V-03 fix #3) — DEFERRED to unit-04 residual risk per the unit spec. | n/a — explicitly deferred |

### V-05 — SPA upload writes used non-deterministic `tick_counter`

| Threat | Control landed | Test |
|---|---|---|
| Tampering (T) — `entry_id` collision lets two distinct audit entries share an ID | Producer fix: SPA `/uploads/knowledge` with `stage === null` switches from `getCurrentTickCounter(iDir)` (non-deterministic readdir-order pick) to the new `getIntentScopeTickCounter(iDir)` (deterministic, monotonic at the intent level, persisted to `intent-tick.json`). | `upload-routes.test.mjs::V-05: two consecutive intent-scope knowledge uploads get distinct, monotonic tick_counter values` (also verifies distinct entry_id — pre-fix this collides). |
| Repudiation (R) — drift gate misclassifies SPA upload as `human-implicit` (silent filesystem drop) instead of `human-via-mcp` | Consumer fix: `drift-detection-gate.ts` action-log lookup now reads the union of per-stage entries (`readActionLogSync`) and intent-scope entries (`readIntentScopeActionLogSync`, new in `drift-baseline.ts`). The `tick_scope` discriminator on each entry routes the read; legacy entries (no `tick_scope`) default to "stage" for back-compat. | `drift-detection-gate.test.mjs::V-05: SPA intent-scope upload (tick_scope='intent') is classified human-via-mcp on a stage tick` — pre-fix the per-tick filter drops the entry and `author_class` falls back to `baselineEntry.author_class` ("agent" via silent auto-add). |
| Information disclosure (I) — misclassified entries name the wrong upstream stage on Assessment records | Eliminated via the same consumer fix — Assessment integrity follows from accurate attribution at the gate. | Indirectly covered by the consumer-union test; Assessment record integrity is checked in `haiku-classify-drift.test.mjs` (existing, no regression introduced). |

### V-06 — `intent.md` archived/locked checks were substring-matched

| Threat | Control landed | Test |
|---|---|---|
| Tampering (T) — agent leaves intent in `status: 'locked'` (single-quoted) and the substring scan misses it; uploads continue | New shared `isIntentLocked(intentDir)` and `isIntentArchived(intentDir)` helpers in `state-tools.ts` parse the YAML frontmatter via `gray-matter`. Both SPA upload routes AND `haiku_human_write` MUST call the shared helpers — the previous asymmetry (MCP used gray-matter, SPA used `raw.includes(...)`) is gone. The two `raw.includes("status: locked")` / `raw.includes("status: archived")` patterns at `upload-routes.ts:111, 125` are deleted; FM gate `v06-no-substring-status-checks-anywhere` enforces repo-wide elimination via `! rg -nE 'raw\.includes\("status:' packages/haiku/src`. | `state-tools-handlers.test.mjs::isIntentLocked recognises single-quoted YAML status: 'locked'`; `upload-routes.test.mjs::V-06: single-quoted ... returns 423 intent_locked` — pre-fix returns 200. |
| Information disclosure (I) — body text quoting `status: locked` (e.g. operator runbook) trips a false positive lock | Eliminated. The shared helpers parse only the frontmatter block; body content is invisible to the gate. | `state-tools-handlers.test.mjs::isIntentLocked is NOT fooled by body text quoting status: locked`; `upload-routes.test.mjs::V-06: body text quoting status: locked is NOT a false-positive lock` — pre-fix returns 423 false positive. |
| Elevation of privilege (E) — attacker with `intent.md` write access leaves status in non-canonical YAML that bypasses the SPA gate while still appearing locked to humans | Eliminated. SPA + MCP agree on what "locked" means via the shared helper; the asymmetric primitive is gone. (TOCTOU on intent.md write itself is sibling unit-03 V-04, not in scope here.) | Shared-helper coverage above; cross-surface agreement is enforced by the shared call sites. |
| DoS (D) — false positives effectively lock an intent that wasn't intended to be locked | Eliminated by the body-text-not-frontmatter test. | `upload-routes.test.mjs::V-06: body text quoting...` |

### `isIntentArchived` parity (V-06 cross-surface contract)

The shared `isIntentArchived` helper recognises BOTH the legacy `status: archived` form AND the new `archived: true` boolean field. `haiku_human_write` previously read only the boolean (`archived === true` at `:400` pre-fix); the SPA route previously substring-scanned for the legacy string. Both surfaces now share the helper and agree on either form. Test: `state-tools-handlers.test.mjs::isIntentArchived recognises status: archived (legacy YAML form)` AND `isIntentArchived recognises archived: true (boolean field form)`.

---

## 3. Implementation references

Specific files / functions / middleware that landed each control.

| Control | File:lines | Function / symbol |
|---|---|---|
| `claimed_author_id` field on persisted audit records | `packages/haiku/src/orchestrator/workflow/write-audit.ts:24-66` | `WriteAuditRecord.claimed_author_id`, `ActionLogEntry.claimed_author_id` |
| `claimed_author_id` reader (rename precedence) | `packages/haiku/src/state-tools.ts:2118-2128` | `readClaimedAuthorId(record)` |
| MCP tool input schema accepts `claimed_author_id` (preferred) and legacy `human_author_id` | `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:325-337` | `haiku_human_write.inputSchema` |
| MCP tool persists both keys on action-log + audit-log entries | `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:660-708` | `appendActionLogEntry(...)`, `appendWriteAudit(...)` calls |
| SPA `/uploads/stage-output` writes both keys | `packages/haiku/src/http/upload-routes.ts:440-475` | route handler stamping action-log + audit-log |
| SPA `/uploads/knowledge` writes both keys + intent-scope tick | `packages/haiku/src/http/upload-routes.ts:678-723` | route handler with `tick_scope` discriminator |
| Intent-scope tick counter (V-05 producer) | `packages/haiku/src/state-tools.ts:2150-2175` | `getIntentScopeTickCounter(intentDirAbsPath)` |
| Drift-gate consumer union (V-05) | `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:535-549` | `runDriftDetectionGate` action-log lookup |
| Intent-scope action-log reader (new) | `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:752-820` | `readIntentScopeActionLogSync(intentDir)` |
| Stage-scope action-log reader (filter tightened to exclude intent-scope entries) | `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:752-800` | `readActionLogSync(intentDir, tickCounter)` |
| Shared `isIntentLocked` helper (V-06) | `packages/haiku/src/state-tools.ts:2056-2068` | `isIntentLocked(intentDirAbsPath)` |
| Shared `isIntentArchived` helper (V-06) | `packages/haiku/src/state-tools.ts:2070-2083` | `isIntentArchived(intentDirAbsPath)` |
| SPA upload routes call shared helpers | `packages/haiku/src/http/upload-routes.ts:101-114` | `isIntentLockedBySlug(slug)`, `isIntentArchivedBySlug(slug)` wrappers |
| `haiku_human_write` calls shared `isIntentArchived` | `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:397-419` | archived intent check (replaces the prior in-line `archived === true` boolean read) |

---

## 4. Test references

Every control above has at least one regression test that fails pre-fix. Test names are stable for FM-gate `grep` checks.

| Concern | Test file | Test name |
|---|---|---|
| V-03 reader rename precedence | `packages/haiku/test/state-tools-handlers.test.mjs` | `readClaimedAuthorId prefers claimed_author_id over human_author_id` |
| V-03 reader legacy fallback | `packages/haiku/test/state-tools-handlers.test.mjs` | `readClaimedAuthorId falls back to human_author_id when claimed_author_id is missing (legacy on-disk records)` |
| V-03 schema acceptance | `packages/haiku/test/state-tools-handlers.test.mjs` | `haiku_human_write accepts claimed_author_id and persists it on the audit log without an unauthorized_author_attribution rejection` |
| V-03 SPA stage-output mirrors both keys | `packages/haiku/test/upload-routes.test.mjs` | `V-03: stage-output upload writes claimed_author_id AND human_author_id (legacy alias)` |
| V-03 SPA knowledge mirrors both keys + tick_scope: intent | `packages/haiku/test/upload-routes.test.mjs` | `V-03: knowledge upload writes claimed_author_id AND human_author_id (legacy alias)` |
| V-05 producer monotonicity + persistence | `packages/haiku/test/state-tools-handlers.test.mjs` | `getIntentScopeTickCounter is deterministic AND monotonic across calls`; `getIntentScopeTickCounter persists across process invocations` |
| V-05 SPA distinct ticks across consecutive intent-scope uploads | `packages/haiku/test/upload-routes.test.mjs` | `V-05: two consecutive intent-scope knowledge uploads get distinct, monotonic tick_counter values` |
| V-05 consumer union (drift gate sees intent-scope entry as human-via-mcp) | `packages/haiku/test/drift-detection-gate.test.mjs` | `V-05: SPA intent-scope upload (tick_scope='intent') is classified human-via-mcp on a stage tick` |
| V-06 single-quoted locked-status detection | `packages/haiku/test/state-tools-handlers.test.mjs` | `isIntentLocked recognises single-quoted YAML status: 'locked'` |
| V-06 double-quoted locked-status detection | `packages/haiku/test/state-tools-handlers.test.mjs` | `isIntentLocked recognises double-quoted YAML status: "locked"` |
| V-06 body-text false-positive elimination | `packages/haiku/test/state-tools-handlers.test.mjs` | `isIntentLocked is NOT fooled by body text quoting status: locked` |
| V-06 SPA route returns 423 on single-quoted locked | `packages/haiku/test/upload-routes.test.mjs` | `V-06: single-quoted status: 'locked' returns 423 intent_locked` |
| V-06 SPA route returns 200 on body-text false positive | `packages/haiku/test/upload-routes.test.mjs` | `V-06: body text quoting status: locked is NOT a false-positive lock` |
| V-06 archived parity (legacy + boolean) | `packages/haiku/test/state-tools-handlers.test.mjs` | `isIntentArchived recognises status: archived (legacy YAML form)`; `isIntentArchived recognises archived: true (boolean field form)` |

Whole-suite gate: `bun run --cwd packages/haiku test` — 1187 passed, 0 failed across 60 test files.

---

## 5. Residual risk

What this unit does NOT cover, with rationale and the follow-up handle.

### Carried forward to unit-04 ASSESSMENTS.md

- **V-03 fix #3 — audit-log hash-chaining** (DEFERRED per unit spec). Without it, an attacker with filesystem write access to `write-audit.jsonl` can rewrite past lines and the rename of `human_author_id` → `claimed_author_id` does not detect tampering. Unit-04 MUST file a `stage_revisit` FB tagged "follow-up: audit-log hash-chaining" and document V-03 as **partially closed** (attribution bound; integrity deferred). Severity: Medium (matches V-03's original severity, downgraded from "the field is forgeable" to "the line itself is mutable"). Acceptance: post-mortem-only; no run-time control.

- **V-03 Option A — server-resolved reviewer identity** (DEFERRED). The unit spec's Option A path requires extending `ReviewSession` (`packages/haiku/src/sessions.ts:149-206`) with a reviewer email/handle field AND building a session-bootstrap UI flow that captures it — a session-schema change and a new SPA flow that's more scope than this unit. Option B (rename) is what shipped; Option A is the integrity-strong follow-up. Threat-modeler recommendation in `THREAT-MODEL-unit-02.md` §2 "Decision driver". Severity: Medium → Low after the rename (consumers no longer treat the field as authoritative, which limits real-world impact; Option A is the long-term strong-authentication path). Acceptance: open follow-up unit, not run-time risk.

### In-scope, intentionally not addressed in unit-02

- **SPA UI rename (`attribute_to_user` form field language → "claim")**. The server stops promoting the field as authoritative; the SPA upload form still labels it `attribute_to_user` and the StageReview / KnowledgeUploadPanel components still display it without "self-reported" annotations. UI follow-up tracked here so the verifier hat doesn't flag it as missing — server-side V-03 Option B is fully landed; UI rename is a separate front-end unit. Severity: Low (the server-side rename is the load-bearing fix; UI labels are belt-and-suspenders).

- **SPA session reviewer-identity capture migration**. When Option A lands, existing in-flight intents that have `claimed_author_id` rows in their audit logs need a forward-only reader that handles both the renamed field (claim) AND a future server-resolved field (let's call it `resolved_author_id`). The reader contract is already present (`readClaimedAuthorId` honours rename precedence); adding a third tier is mechanical. Severity: N/A (forward-only audit-log semantics already accommodate this).

### Pre-existing — outside this unit's surface

- **Concurrent-process tick-counter races** (cross-process). `getIntentScopeTickCounter` is best-effort single-process — the read-increment-write happens on the JS single thread before the next `await` boundary, so two concurrent SPA uploads from the SAME MCP process see distinct values. Two concurrent MCP processes (different harness invocations writing to the same intent dir) could race on the counter file. This is a pre-existing intent-design property ("Concurrency model is eventual-consistency: no locking, the next `haiku_run_next` tick observes drift" — intent.md). Severity: Low. Acceptance: documented intent-level constraint; real fix lives in audit-log hash-chaining (deferred above).

- **Sibling `human_author_id` propagation paths in non-server code** (e.g. `packages/haiku-ui/...`). The server now writes `claimed_author_id`, but UI components reading the audit log (or feedback metadata) may still pluck `human_author_id`. This is back-compat-safe (legacy alias is mirrored) but creates a temporary inconsistency in the UI. Severity: informational. Acceptance: UI follow-up tracked above.

### Explicitly NOT my surface (carried by sibling units)

- V-01 / V-02 (SPA upload content validation, MIME/extension allowlist) — sibling unit-01.
- V-04 (`haiku_human_write` symlink TOCTOU) — sibling unit-03.
- V-07 (`HAIKU_UPLOAD_MAX_BYTES` no upper bound) — sibling unit-03 or follow-up.
- V-08 (no CSRF protection on SPA upload routes) — sibling unit-03.
- V-09 (unbounded `agent_rationale`) — sibling unit-04 ASSESSMENTS residual risk.
- V-10 (unsanitised `feedback_creates[].body`) — sibling unit-04 ASSESSMENTS residual risk.
- V-11 (`baseline_corrupt` operator-trust elevation) — documentation-level, unit-04.

---

## 6. References

- `knowledge/VULN-REPORT.md` (V-03, V-05, V-06) — original findings.
- `stages/security/artifacts/THREAT-MODEL-unit-02.md` — STRIDE per data flow + acceptance criteria for the implementer hat (this artifact's input).
- `stages/security/units/unit-02-author-identity-binding.md` — unit spec + frontmatter quality_gates (every gate above is enforced by FM gate at advance_hat).
- `plugin/studios/software/stages/security/hats/security-engineer.md` — hat description (deliverable shape this artifact follows).
- `memory.md::feedback_modes_taxonomy` — autopilot-mode contract referenced in the autopilot-mode test alignment commit note.
- Code: see §3 above for file:line references to every landed control.
- Tests: see §4 above for test file:name references to every regression test.
