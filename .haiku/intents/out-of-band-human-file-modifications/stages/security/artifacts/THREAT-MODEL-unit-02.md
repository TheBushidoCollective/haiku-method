# Threat Model — Unit 02 (Author Identity Binding + Status-Check Correctness)

STRIDE-driven threat model scoped to the three findings owned by this unit
(V-03 author attribution, V-05 SPA tick-counter ambiguity, V-06 substring
status checks). Sibling artifact `THREAT-MODEL.md` (unit-04) is the
intent-wide model; this one zooms in on the data flows the implementer is
about to touch and drives the acceptance criteria for the implementer
hat.

The vuln-report (`knowledge/VULN-REPORT.md`) already carries reproduction
steps, evidence, and severity. This artifact answers the question
*"after the fixes land, what attack surface remains, and what trust
boundary did each fix actually move?"* — STRIDE per data flow, not a
re-walk of the bug.

---

## 1. System under fix (the three data flows)

### Flow A — Author attribution (V-03)
```
    ┌────────────────┐  attribute_to_user (multipart text)
    │  Reviewer UA   │ ───────────────────────────────────────┐
    │  (browser)     │                                        ▼
    └────────────────┘                          ┌──────────────────────────┐
                                                │ POST /api/intents/:slug/ │
    ┌────────────────┐  human_author_id (arg)   │   uploads/{stage-output, │
    │  Agent         │ ───────────────────────▶ │   knowledge}             │
    │  (Claude Code) │                          │   (upload-routes.ts)     │
    └────────────────┘                          └──────────────┬───────────┘
            │                                                  │
            │  haiku_human_write { human_author_id, ... }      │
            ▼                                                  │
    ┌──────────────────────────┐                               │
    │  haiku_human_write tool  │ ──────────────────────────────┤
    │  (state-tools / tool)    │                               │
    └──────────────────────────┘                               │
                                                               ▼
                                                ┌──────────────────────────┐
                                                │  write-audit.jsonl       │ (durable record of "who")
                                                │  action-log.jsonl        │
                                                └──────────────┬───────────┘
                                                               │
                                                               ▼
                                                ┌──────────────────────────┐
                                                │  drift-detection-gate.ts │ (consumer — uses author_class
                                                │  → BaselineEntry.author_ │  to populate Assessment)
                                                │     class                │
                                                └──────────────────────────┘
```

### Flow B — SPA upload tick stamping (V-05)
```
SPA upload (stage=null)
    └──▶ getCurrentTickCounter(iDir)              ◀── readdirSync order picks tick
              │                                      from a non-deterministic stage
              ▼
       nextEntryId(tick, 1)
              │
              ▼
    write-audit.jsonl  +  action-log.jsonl
              │
              ▼
    drift-detection-gate.ts → readActionLogSync(intentDir, tickCounter)
                                   │
                                   ▼
                        per-tick filter — MISSES SPA entries stamped
                        under a different stage's tick
                                   │
                                   ▼
                        author_class falls back to baselineEntry.author_class
                        ("agent" / "human-implicit") — provenance lost
```

### Flow C — Lock / archive enforcement (V-06)
```
SPA upload  ──▶  isIntentWorktreeLocked(slug)
                       │
                       ▼
                 readFileSync(intent.md)
                       │
                       ▼
                 raw.includes("status: locked")  ◀── matches ANY substring
                                                    in body, frontmatter,
                                                    or quoted prose
```

### Trust boundaries (the line each fix is moving)

| Boundary | Today | After unit-02 |
|---|---|---|
| Reviewer (browser) → SPA upload route | Reviewer self-stamps `attribute_to_user` | (Option A) Server resolves `human_author_id` from `sid` → session lookup. Field rejected from request. (Option B) Field renamed `claimed_author_id` so consumers stop trusting it. |
| Agent → `haiku_human_write` tool | Agent self-stamps `human_author_id` | (Option A) Server fills from `os.userInfo().username`. Agent override rejected with `unauthorized_author_attribution`. (Option B) Field renamed `claimed_author_id`. |
| SPA upload → audit-log consumer | SPA writes piggyback on a non-deterministic stage's tick | SPA writes are stamped against an intent-scope tick counter; drift gate unions per-stage and intent-scope action-log entries when classifying. |
| SPA → intent-status enforcement | `raw.includes("status: locked")` substring scan | `gray-matter` parse, behind a shared `isIntentLocked()` / `isIntentArchived()` helper. SPA and `haiku_human_write` MUST agree on status semantics. |

---

## 2. STRIDE per flow

### Flow A — Author attribution

| Threat | Today (pre-fix) | Option A (resolved identity) | Option B (renamed field) |
|---|---|---|---|
| **S — Spoofing** | A reviewer with a valid JWT can post `attribute_to_user=ceo@company.com`. Agent can pass arbitrary `human_author_id`. | Eliminated: server resolves identity from `sid` (SPA) and `os.userInfo()` (MCP). Agent override rejected. | Not eliminated — the threat is downgraded to "claim", not "identity". Consumers MUST treat the field as untrusted. |
| **T — Tampering** | Audit-log lines contain spoofed identity. No detection. | Mitigated for new lines (server-stamped). Past lines remain spoofable until log hash-chaining (V-03 fix #3) ships — DEFERRED to unit-04 residual risk. | Not addressed — the field is renamed but unsigned. |
| **R — Repudiation** | Reviewer can deny they uploaded ("attribute_to_user was set by someone else"). | Resolved on the SPA path so long as the session table reliably maps `sid → reviewer email`. MCP path uses OS user — strong on a single-user dev box, weak on shared Claude Code runners. | Not resolved — `claimed_author_id` is explicitly non-repudiation-bearing. |
| **I — Information disclosure** | Forged identity surfaces in feedback/audit UIs and may name innocent third parties. | Mitigated. | Mitigated only if the SPA UI also renames the field everywhere it surfaces. UI rename is a load-bearing AC. |
| **D — DoS** | None directly attributable to V-03. | None. | None. |
| **E — Elevation of privilege** | A reviewer can frame a higher-trust principal (`ceo@company.com`) and survive triage if the audit log is the only durable evidence. | Eliminated. | Mitigated by transparency — consumers know the field is a claim, not an identity. |

**Decision driver for the implementer (A vs B):**
- The session table (`packages/haiku/src/sessions.ts:149-206` `ReviewSession` interface) currently has NO reviewer email/handle field. Option A on the SPA side requires a session-schema extension AND a session-bootstrap UI flow that captures reviewer identity. That is ADDITIONAL scope on top of the V-03 fix.
- The MCP side has `os.userInfo().username` available today; that's a one-line change.
- **Recommendation (threat-modeler):** ship Option B as the unit-02 baseline (rename → `claimed_author_id`, no schema change, immediate consistency between surfaces), and file an intent-scope feedback for "Option A — reviewer-identity capture in session bootstrap" as a follow-up unit. Option A in this unit alone risks a half-built bootstrap flow that's worse than the rename.
- The unit spec already accepts either; this artifact records the trade-off so the implementer hat doesn't have to re-derive it.

**Residual risk after either option (carry to unit-04 ASSESSMENTS.md):**
- VULN-REPORT V-03 fix #3 (audit-log hash-chaining) is OUT OF SCOPE here. Without it, an attacker with filesystem write access can still rewrite `write-audit.jsonl` lines after the fact. Document this in unit-04 as "V-03 partially closed (attribution bound; integrity deferred)" and file a `stage_revisit` FB tagged "follow-up: audit-log hash-chaining".

### Flow B — SPA upload tick stamping

| Threat | Today | After fix (intent-scope tick + consumer union) |
|---|---|---|
| **S — Spoofing** | Not the primary threat surface. | Unchanged. |
| **T — Tampering** | `entry_id = HWM-{tick}-{NN}` collisions across stages can let an attacker create two distinct audit entries that share an ID — downstream tooling that dedupes by entry_id silently drops one. | Eliminated: intent-scope tick is monotonic at the intent level; entry-IDs are unique. |
| **R — Repudiation** | A reviewer can deny initiating an SPA upload because the drift gate misclassifies it as `human-implicit` (anonymous filesystem touch) rather than `human-via-mcp` (sanctioned upload). | Eliminated for SPA writes: drift gate consumer unions per-stage AND intent-scope action-log entries, so the upload appears as `human-via-mcp` regardless of which tick the gate is firing on. |
| **I — Information disclosure** | Misclassified entries appear under the wrong stage's `BaselineEntry.author_class`, so the assessment record names the wrong upstream. | Eliminated. |
| **D — DoS** | None directly. (Adjacent to V-07's sync-SHA blocking concern, but out of scope here.) | None. |
| **E — Elevation of privilege** | Not the primary threat — this is integrity of the audit narrative. | N/A. |

**Critical AC for the implementer (raised by pre-execute review):**
- Producer-only fix is INSUFFICIENT. The drift-gate consumer at `drift-detection-gate.ts:535-647` filters `readActionLogSync(intentDir, tickCounter)` by the firing stage's tick. If the SPA write is stamped at intent-scope tick=N and the gate fires from stage=X with stage.iteration=M, the per-tick lookup returns nothing → fallback at `:646` mis-attributes.
- The consumer change MUST union per-stage and intent-scope entries when scanning intent-scope tracked surface. Both producer AND consumer changes are in this unit's scope. The unit spec already calls this out — this artifact reinforces it as a hard AC.

### Flow C — Lock / archive enforcement

| Threat | Today | After fix (gray-matter + shared helper) |
|---|---|---|
| **S — Spoofing** | Not directly. | N/A. |
| **T — Tampering** | An agent (or anyone with write access to `intent.md`) can leave the intent in a `locked` status that the SPA route doesn't recognise (single-quote, no-space, newline-folded YAML), and uploads continue. The contract "locked intents block out-of-band writes" is silently broken. | Eliminated: `gray-matter` parses the frontmatter regardless of YAML formatting. SPA + `haiku_human_write` agree because both call the same `isIntentLocked` / `isIntentArchived` helper. |
| **R — Repudiation** | A reviewer can claim "I didn't realise the intent was locked" because the SPA accepted the upload. | Eliminated: false negatives go to zero, so accepted uploads are unambiguously on an unlocked intent. |
| **I — Information disclosure** | False POSITIVES: a knowledge artifact whose body legitimately quotes "status: locked" (e.g. operator runbook, this very threat-model document) trips the gate. The reviewer sees 423 with no actionable error. | Eliminated: only frontmatter `status` triggers the gate, body content is irrelevant. |
| **D — DoS** | False positives on body content can effectively lock an intent that wasn't intended to be locked, blocking out-of-band uploads. | Eliminated. |
| **E — Elevation of privilege** | An attacker who can write `intent.md` (TOCTOU-class — see V-04, sibling unit-03) can leave the intent in a non-canonical "locked" status that bypasses the SPA gate while still appearing locked to humans reading the file. The MCP side (`haiku_human_write` already uses `gray-matter`) correctly refuses; the SPA side does not. This is the asymmetric primitive that makes V-06 a real finding, not just a hygiene cleanup. | Eliminated: SPA + MCP agree on what "locked" means. The asymmetry is gone. |

**Critical AC for the implementer:**
- The frontmatter gate `v06-no-substring-status-checks-anywhere` MUST assert REPO-WIDE elimination, not just the two known sites at `upload-routes.ts:111, 125`. Proof-of-work: a `grep -rn 'raw\.includes("status:' packages/haiku/src/` returning zero hits in source files (excluding tests that intentionally exercise the legacy path).
- The shared helpers MUST live in `state-tools.ts` (NOT `validation.ts`) per the unit spec, because they read from intent state and need `intentDir()` resolution that's already centralised there.
- `git-worktree.ts:612-1158` `raw.includes(...)` calls are matching git-CLI stderr ("would be overwritten by checkout"), NOT intent.md status — exclude from the AC scope.

---

## 3. Attack surface inventory after fixes land

| Surface | Trust level | Authentication | Author binding | Status enforcement |
|---|---|---|---|---|
| `POST /api/intents/:intent/uploads/stage-output` | Tunnel: JWT-required. Local: trusted. | `requireTunnelAuth` (HS256 JWT, sid+tun bound) | Option A: server-resolved from `sid → session.reviewer_email`. Option B: caller-supplied `claimed_author_id` recorded as a claim. | Shared `isIntentLocked()` / `isIntentArchived()` helpers (gray-matter) |
| `POST /api/intents/:intent/uploads/knowledge` | Same | Same | Same | Same |
| `haiku_human_write` MCP tool | Trusted-but-honest agent | None (in-process MCP) | Option A: server-stamped from `os.userInfo().username`. Option B: caller-supplied `claimed_author_id` as a claim. | Same shared helpers |
| `write-audit.jsonl` / `action-log.jsonl` | Append-only (no integrity check) | N/A | Resolved or claimed identity (per chosen option) | N/A |
| `drift-detection-gate.ts` consumer | In-process | N/A | Reads `human_author_id` from action-log entries; classifies SPA writes as `human-via-mcp` regardless of tick scope | Reads via shared helper indirectly (gate doesn't enforce locked-status; that's at the upload chokepoint) |

---

## 4. Threats explicitly out of scope for this unit

These show up in the broader vuln-report but are owned by other units or carried as residual risk. The threat-modeler artifact records them so the implementer hat doesn't accidentally take on extra scope and the verifier hat knows what NOT to flag missing:

- **V-01 (HIGH) — knowledge upload accepts `image/svg+xml` filename, served as inline SVG / HTML:** sibling unit-01 (upload content validation).
- **V-02 (HIGH) — stage-output upload doesn't constrain content-type:** sibling unit-01.
- **V-04 (MED) — symlink TOCTOU on parent directory creation:** sibling unit-03.
- **V-07 (MED) — `HAIKU_UPLOAD_MAX_BYTES` has no upper bound:** sibling unit-03 or follow-up.
- **V-08 (MED) — no CSRF protection on SPA upload routes:** sibling unit-03.
- **V-09 (LOW) — unbounded `agent_rationale`:** unit-04 ASSESSMENTS residual risk.
- **V-10 (LOW) — unsanitised `feedback_creates[].body`:** unit-04 ASSESSMENTS residual risk.
- **V-11 (LOW) — `baseline_corrupt` operator-trust elevation:** documentation-level, unit-04.
- **VULN-REPORT V-03 fix #3 — audit-log hash-chaining:** explicitly DEFERRED. unit-04 MUST file a `stage_revisit` FB tagged "follow-up: audit-log hash-chaining" and document V-03 as "partially closed (attribution bound; integrity deferred)".

---

## 5. Acceptance criteria (handoff to the implementer hat)

These are the THREAT-MODEL-derived ACs the implementer must meet. The
unit's `quality_gates:` frontmatter is the executable counterpart; this
list is the human-readable rationale.

### V-03 (author attribution)
1. **Pick A or B explicitly and apply consistently to BOTH surfaces.** Mixing (A on SPA, B on MCP, or vice versa) is a hard fail — consumers cannot reason about a heterogeneous attribution model.
2. **If Option A:** the SPA `attribute_to_user` multipart field MUST be rejected with `unauthorized_author_attribution` when present. The MCP `human_author_id` arg MUST be rejected with the same code when supplied. Server-resolved value is the only path. Session bootstrap must capture reviewer email/handle into the session table (new field on `ReviewSession`).
3. **If Option B:** the field MUST be renamed `claimed_author_id` everywhere it's persisted (`write-audit.jsonl`, `action-log.jsonl`, `BaselineEntry`, SPA UI labels, MCP tool schema description). The schema description MUST keep the "self-reported — not validated" callout but reframe as "this is a claim, not an authority".
4. **Either way:** the schema and audit-log writers MUST be updated atomically — no migration window where readers see a mix of `human_author_id` and `claimed_author_id` keys. Existing on-disk audit lines remain in the legacy form (forward-only); readers handle both keys with `claimed_author_id ?? human_author_id` precedence.

### V-05 (SPA tick stamping)
1. **Producer:** introduce `getIntentScopeTickCounter(intentDir)` (deterministic, intent-level). SPA uploads with `stage === null` use this counter, NOT `getCurrentTickCounter(intentDir)` (which keeps its non-deterministic readdir-order behaviour for callers that legitimately don't know the active stage — but those callers should be eliminated or audited separately).
2. **Consumer:** `drift-detection-gate.ts:535-647` action-log lookup MUST union per-stage and intent-scope entries when classifying any tracked file. The current per-tick filter is the source of the miss.
3. **Test (executable):** create an intent with two stages where iterations differ; POST a stage=null knowledge upload; trigger drift-gate ticks under each stage; assert the upload is classified `human-via-mcp` in BOTH ticks. Pre-fix this test fails on the stage whose iteration doesn't match the picked tick.

### V-06 (status checks)
1. **Replace** `raw.includes("status: locked")` and `raw.includes("status: archived")` patterns at `upload-routes.ts:111, 125` with `gray-matter` parsing.
2. **Centralise** as `isIntentLocked(intentDir)` / `isIntentArchived(intentDir)` helpers exported from `packages/haiku/src/state-tools.ts`. Both `upload-routes.ts` (SPA) and `haiku_human_write` (MCP) MUST call the shared helpers.
3. **Frontmatter gate `v06-no-substring-status-checks-anywhere`** asserts repo-wide elimination via `grep -rn 'raw\.includes("status:' packages/haiku/src/` returning zero matches outside test files.
4. **Behavioural test:** intent with `status: 'locked'` (single-quote, non-canonical YAML) MUST cause the SPA upload to return 423; intent body containing the literal string `status: locked` in prose (e.g. an operator runbook excerpt) MUST NOT cause the SPA upload to return 423.

---

## 6. Verifier hat's checklist (what the verifier MUST confirm)

- [ ] V-03 option A vs B is explicitly chosen in the implementation commit message AND the chosen option is consistently applied to BOTH SPA and MCP surfaces (no asymmetry).
- [ ] If Option A, `ReviewSession` has a new field for reviewer identity AND the session-bootstrap code populates it. If Option B, every persistence site uses the renamed `claimed_author_id` key.
- [ ] V-05 producer change adds `getIntentScopeTickCounter(intentDir)` AND the consumer at `drift-detection-gate.ts` reads the union (per-stage ∪ intent-scope) of action-log entries.
- [ ] V-05 has a regression test that fails on producer-only fix (i.e. demonstrates the consumer change is load-bearing).
- [ ] V-06 substring patterns at `upload-routes.ts:111` and `upload-routes.ts:125` are gone. Repo-wide grep for `raw\.includes("status:` returns zero source matches.
- [ ] V-06 shared helpers live in `state-tools.ts` and are called from BOTH the SPA upload route AND `haiku_human_write`.
- [ ] V-06 behavioural test covers single-quoted `status: 'locked'` and body-text false-positive.
- [ ] All three findings have at least one executable `quality_gates:` entry on the unit frontmatter.
- [ ] `bun run --cwd packages/haiku test` passes end-to-end.
- [ ] V-03 fix #3 (audit-log hash-chaining) is NOT attempted in this unit and is correctly carried forward as a unit-04 residual-risk entry.

---

## 7. References

- Vuln report (sibling artifact): `knowledge/VULN-REPORT.md` — V-03, V-05, V-06 entries.
- Source files in scope:
  - `packages/haiku/src/http/upload-routes.ts` (V-03 SPA `attribute_to_user`, V-05 `getCurrentTickCounter` call site, V-06 substring checks)
  - `packages/haiku/src/http/auth.ts` (JWT shape and `sid` claim — Option A's resolution input)
  - `packages/haiku/src/sessions.ts` (`ReviewSession` interface — schema extension target for Option A)
  - `packages/haiku/src/tools/orchestrator/haiku_human_write.ts` (V-03 MCP `human_author_id`)
  - `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts:535-647` (V-05 consumer)
  - `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:670-714` (`getCurrentTickCounter`)
  - `packages/haiku/src/orchestrator/workflow/write-audit.ts` and `action-log.ts` (audit-log writers)
  - `packages/haiku/src/state-tools.ts` (target for V-06 shared helpers)
- Unit spec: `stages/security/units/unit-02-author-identity-binding.md`
- Stage scope: `plugin/studios/software/stages/security/STAGE.md`
- Hat: `plugin/studios/software/stages/security/hats/threat-modeler.md`
