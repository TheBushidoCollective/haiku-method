# Red-Team Report — Unit 02 (Author Identity Binding + Status-Check Correctness)

Adversarial review of the unit-02 implementation that closed V-03 / V-05 / V-06
(commits `30a696f04`, `399c2ee13`, `94588f783`). Scope: attack-surface analysis,
auth-bypass attempts, injection testing, and gap-finding on the three
mitigations. Quality-gates and the full Bun test suite (1187 / 1187) pass — the
findings below are residual attack surface that the in-tree gates and tests
don't exercise.

Methodology: code review of every changed file plus the call-paths the new
helpers participate in. Each finding cites the exact file:line, the attack
narrative, the precondition, and a concrete fix recommendation.

---

## Severity legend

- **HIGH** — exploitable today by a caller with a legitimate session/token; bypasses an explicit V-03/V-05/V-06 control claim.
- **MED**  — exploitable under a non-default but realistic config (multi-process MCP, large-field POST), or breaks a sibling control (V-05 producer fix on the MCP path).
- **LOW** — defense-in-depth gap; no working exploit today but the contract
  surface relies on luck rather than enforcement.

---

## R-01 (HIGH) — SPA upload routes accept any valid tunnel JWT for any intent (cross-session write authorization bypass)

**Files**

- `packages/haiku/src/http/upload-routes.ts:214` (stage-output)
- `packages/haiku/src/http/upload-routes.ts:497` (knowledge)
- `packages/haiku/src/http/auth.ts:34` (`requireTunnelAuth`)
- `packages/haiku/src/http/auth.ts:57` (`verifyFeedbackMutationAuth`)

**Attack narrative.** Both upload routes call only:

```ts
if (!requireTunnelAuth(req, reply, null)) return
```

passing `expectedSid: null`, which validates the JWT signature and expiry but
does NOT bind the JWT's `sid` claim to the `intent` slug in the URL.
Compare the feedback API surface, which calls BOTH `requireTunnelAuth(...)`
AND `verifyFeedbackMutationAuth(req, reply, intent)` (`feedback-api.ts:248,
328, 416, 509`) — the latter pulls the `sid` out of the JWT, looks up the
review session, and rejects with `forbidden_cross_session` /
`reason: intent_mismatch` if `session.intent_slug !== intent`.

The upload routes skip that bind. Net effect: a tunnel-mode reviewer holding
a valid JWT for review session `S1` (bound to intent `A`) can `POST` files to
`/api/intents/B/uploads/stage-output` and the server writes them, attributes
them to whatever `attribute_to_user` value the attacker submits, and stamps
both `action-log.jsonl` and `write-audit.jsonl` of intent `B` with
`author_class: "human-via-mcp"`.

**Precondition.** Tunnel mode enabled (`HAIKU_TUNNEL_*` configured) +
attacker holds any valid review-session JWT (e.g. their own legitimate review
session for some other intent, or a leaked/intercepted one).

**Why this matters for V-03.** The unit picked Option B (rename to
`claimed_author_id`) explicitly because the SPA "has no reviewer-identity
field today" and so the field is "what the caller claimed, not who did it."
That framing assumes the caller is at least bound to the right intent. With
R-01 open, the attribution log records "alice (claimed) wrote to intent B" on
behalf of a session that was never authorized to touch intent B — the
attribution is doubly fraudulent (wrong author + wrong intent).

**Fix recommendation.** Add `verifyFeedbackMutationAuth(req, reply, intent)`
(or a renamed `verifyIntentMutationAuth(...)`) immediately after
`requireTunnelAuth(...)` on both upload routes. The function already exists,
already does exactly this check for the feedback surface, and would be a
two-line additions per route.

**Test gap.** No test in `upload-routes.test.mjs` exercises the
cross-session JWT path. Add: a tunnel-mode test that bootstraps two review
sessions for two intents, then attempts an upload with `S1`'s JWT to `S2`'s
intent and asserts `403 forbidden_cross_session`.

---

## R-02 (HIGH) — V-05 producer fix is incomplete: `haiku_human_write` MCP path retains the non-deterministic `getCurrentTickCounter` bug for intent-scope writes

**Files**

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:653`
- `packages/haiku/src/orchestrator/workflow/drift-baseline.ts:677` (`getCurrentTickCounter` w/o stage arg → `readdirSync` order)

**Attack narrative.** The unit's own VULN-REPORT V-05 note states the producer
must return a deterministic counter when `stage === null`. The SPA upload
route (`upload-routes.ts:688-693`) honors this: it switches to
`getIntentScopeTickCounter(iDir)` when `stage === null` and stamps
`tick_scope: "intent"`.

But the MCP path does not. `haiku_human_write` calls:

```ts
const tickCounter = getCurrentTickCounter(intentDir) // line 653 — no stage arg
```

When called with no `stage` argument, `getCurrentTickCounter` (drift-baseline.ts:702)
falls into the `readdirSync(stagesDir)` for-loop and returns the FIRST
stage's `iteration` value. Loop order is filesystem-dependent (OS, inode
allocation, locale) — non-deterministic. This is the EXACT bug V-05 identified
on the SPA side; it is unfixed on the MCP side.

A user instructing the agent to call `haiku_human_write` with path
`knowledge/foo.md` (legitimate intent-scope use) produces an action-log entry
with:

- a non-deterministic `tick_counter` value (whichever stage's iteration `readdirSync` returned first)
- `tick_scope: "stage"` (line 676 — hard-coded)

Two problems compound:

1. **Producer collision.** Two consecutive MCP intent-scope writes can pick
   the same `tick_counter` (entire stage iteration didn't advance between
   calls), and `nextEntryId(tickCounter, seqNumber)` only disambiguates by
   the audit-log line count — but the action-log's `entry_id` collides
   with any per-stage entry that shares the chosen tick. Same V-05 collision
   the SPA fix was supposed to prevent.
2. **Consumer miss.** The drift-gate consumer fix unions
   `readActionLogSync(intentDir, tickCounter)` (`tick_scope === "stage" |
   undefined`) with `readIntentScopeActionLogSync(intentDir)`
   (`tick_scope === "intent"`). MCP intent-scope writes are stamped
   `tick_scope: "stage"` so they go into the per-stage union — and that's
   filtered to `tick_counter === tickCounter`. If the firing stage's tick
   doesn't match the producer's lottery-winner stage tick, the entry is
   dropped. The `human-via-mcp` provenance is lost; the file falls back to
   `baselineEntry.author_class` (typically `"agent"`).

This is the exact failure mode V-05 was filed to fix, just with the agent
holding the gun instead of the SPA.

**Precondition.** A user instructs the agent to write an intent-scope file
(`knowledge/...`) via `haiku_human_write`. No multi-process race needed.

**Fix recommendation.** Mirror the SPA branch in `haiku_human_write`:

```ts
const isIntentScope = !canonicalPath.startsWith("stages/")
const tickCounter = isIntentScope
  ? getIntentScopeTickCounter(intentDir)
  : getCurrentTickCounter(intentDir, /* derive from canonicalPath */)
const tickScope = isIntentScope ? "intent" : "stage"
// ... pass tickScope into both action-log and audit-log entries
```

Stage-scope MCP writes (`stages/X/...`) need to pass the parsed stage slug to
`getCurrentTickCounter` instead of relying on the no-arg `readdirSync`
fallback — same root cause, just at stage scope rather than intent scope.

**Test gap.** No MCP-side V-05 test. The only V-05 test
(`upload-routes.test.mjs`) verifies the SPA path returns monotonic distinct
intent-scope ticks across two consecutive uploads. Add a parallel
`state-tools-handlers.test.mjs` test for `haiku_human_write` writing two
intent-scope files and asserting the resulting action-log entries surface as
`human-via-mcp` on a stage-tick drift-gate run.

---

## R-03 (HIGH) — `haiku_human_write` ignores `isIntentLocked` (V-06 helper coverage gap)

**Files**

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:38` (imports only `isIntentArchived`)
- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:414` (only archived check fires)
- `packages/haiku/src/http/upload-routes.ts:239, 519` (SPA route checks both)

**Attack narrative.** The SPA upload routes check both `isIntentArchivedBySlug`
AND `isIntentLockedBySlug` (returning 404 and 423 respectively). The MCP tool
imports `isIntentArchived` only and gates on archive state alone (line 414).
`isIntentLocked` is never called in the MCP path — meaning a worktree-locked
intent rejects SPA uploads (`intent_locked` 423) but happily accepts
`haiku_human_write` MCP calls.

This breaks the unit spec's V-06 mitigation #2 ("Both `upload-routes.ts` and
`haiku_human_write` (state-tools.ts) call the shared helper. The frontmatter
gate `v06-no-substring-status-checks-anywhere` asserts repo-wide elimination
of the anti-pattern."). The shared-helper rule is half-implemented: archived
agrees, locked diverges. An operator who locks an intent (e.g. mid-revisit,
to freeze it for human inspection) can still be bypassed by an agent calling
`haiku_human_write`.

**Precondition.** Intent has `status: locked` in `intent.md` frontmatter +
agent invokes `haiku_human_write`.

**Fix recommendation.** Add `isIntentLocked(intentDir)` import and a sibling
guard right next to the existing `isIntentArchived` block (line 414). Return
`intent_locked` error consistently with the SPA's `423`.

**Test gap.** No test in `state-tools-handlers.test.mjs` for "locked intent
rejects haiku_human_write". The 16 V-06 helper tests only cover the helpers
in isolation, not their integration into the MCP tool.

---

## R-04 (HIGH) — `attribute_to_user` field is unbounded; log-bloat DoS via 1 MB attribution per upload

**Files**

- `packages/haiku/src/http/upload-routes.ts:202-207` (no `fieldSize` limit on `@fastify/multipart`)
- `packages/haiku/src/http/upload-routes.ts:265-266, 543-544` (raw multipart value used as attribution)
- `packages/haiku/src/http/upload-routes.ts:454-455, 469-470, 702-703, 717-718` (attribution echoed to action-log + audit-log on every upload)

**Attack narrative.** `@fastify/multipart` is registered with only
`limits: { fileSize, files }`. The multipart `fields` count limit and the
per-`fieldSize` limit are left at their library defaults (busboy defaults to
`fieldSize: 1 MB`, `fields: Infinity`). The handler reads
`(part as { value: string }).value` and uses it as `attribute_to_user`
without any length validation, control-character validation, or character-
set normalization.

A POST that includes:

```
Content-Disposition: form-data; name="attribute_to_user"

<1 048 576 bytes of "A">
```

writes ~1 MB into BOTH `action-log.jsonl` AND `write-audit.jsonl` per upload
(through `JSON.stringify` — newlines are escaped, so the file structure
remains valid JSONL but each line is ~2 MB after escaping). Repeated 1 000
times by a tunnel-authenticated reviewer and you have a 2 GB action-log on
disk — append-only, no rotation, never garbage-collected. Every drift-gate
tick reads the entire file synchronously (`readFileSync` in
`readActionLogSync` / `readIntentScopeActionLogSync`), so log-bloat directly
amplifies into per-tick CPU + memory.

**Precondition.** Any valid SPA upload session (loopback or tunnel) +
attacker willing to upload tiny files with huge attribution claims.

**Fix recommendation.** Two-part:

1. Add `fieldSize: 256` (bytes) and `fieldNameSize: 64` to the
   `@fastify/multipart` `limits` block. This caps the attack surface at the
   library boundary.
2. Add explicit attribution-validation in `attribute_to_user` parsing:
   trim, reject empty, reject longer than (e.g.) 200 chars, reject
   non-printable / control chars, reject newlines (defense-in-depth even
   though `JSON.stringify` escapes them).

Apply the same validation to `claimed_author_id` / `human_author_id` in
`haiku_human_write` (`tools/orchestrator/haiku_human_write.ts:369-372`) —
that path takes the value straight from the MCP tool args without any cap,
so a malicious agent can write arbitrary-length attribution.

**Test gap.** No size-cap or character-validation tests for
`attribute_to_user` in `upload-routes.test.mjs`. Add: 1 KB, 1 MB, control
chars, newline-injection-attempt cases.

---

## R-05 (MED) — `getIntentScopeTickCounter` cross-process race re-introduces V-05 collisions under multi-MCP / multi-tenant setups

**Files**

- `packages/haiku/src/state-tools.ts:2173-2197` (`getIntentScopeTickCounter`)

**Attack narrative.** The implementation is plain read-modify-write with no
file lock:

```ts
if (existsSync(tickFile)) {
  const raw = readFileSync(tickFile, "utf-8")
  // ... parse + extract `current`
}
const next = current + 1
writeFileSync(tickFile, JSON.stringify({ tick: next }, null, 2))
return next
```

Two concurrent MCP processes (e.g. user has two Claude Code sessions open
against the same repo, each running an MCP server) racing on the same intent:

```
P1: read  → current=5
P2: read  → current=5
P1: write → tick=6
P2: write → tick=6
P1: return 6
P2: return 6
```

Both uploads get `entry_id` derived from `tick=6` → same V-05 collision class.

The implementation comment acknowledges the gap ("Cross-process races... are
not in scope") but the unit spec V-05 only said "deterministic intent-scope
counter" without the single-process caveat. Multi-MCP is a real config —
e.g. two terminal panes both running `claude` against the same repo, or the
upcoming MCPB / cowork model where the desktop MCP and a background CLI
both exist.

**Precondition.** Two MCP servers reaching the same `.haiku/intents/{slug}/`
+ concurrent intent-scope SPA uploads (or `haiku_human_write` calls once
R-02 is fixed).

**Fix recommendation.** Use atomic file primitives:

- Lock approach: `fs.openSync(tickFile, 'r+')` + `fcntl`-style advisory
  lock via `proper-lockfile` or a tempfile-rename dance.
- Lockless approach: `O_APPEND` an entry into a counter-log file and read
  the line count, identical to how `appendWriteAudit` already handles
  multi-writer JSONL semantics.

The `mkdirSync(dirname(tickFile), { recursive: true })` already imports the
`gray-matter`-free state-tools surface, so `proper-lockfile` is a viable
add. Either way, the comment "best-effort single-process counter" needs to
become a contract documented in the unit-04 ASSESSMENTS residual risk
section.

---

## R-06 (MED) — `intent-tick.json` is not on the haiku_human_write deny-list (defense-in-depth gap)

**Files**

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:79-128` (`DENY_LIST`)
- `packages/haiku/src/state-tools.ts:2156-2158` (`intentScopeTickPath`)

**Attack narrative.** `intent-tick.json` lives at the intent root (sibling of
`intent.md`) — outside any allow-list pattern (`knowledge/`, `stages/{stage}/...`),
so today the allow-list rejects writes to it implicitly with
`no_allow_match`. But the deny-list also doesn't name it, while sibling
internal artifacts (`baseline.json`, `drift-markers.json`, `write-audit.jsonl`,
`drift-assessments/`) ARE explicitly listed.

Defense-in-depth principle: every workflow-engine-internal artifact should be
on the deny-list, not just allow-list-excluded. If the allow-list is ever
broadened (e.g. to permit an `intent.md`-adjacent README write, or to add a
new top-level docs/ surface), `intent-tick.json` becomes silently writable
and an attacker can force ID collisions or roll the counter back.

**Precondition.** A future change broadens the allow-list. Today: not
exploitable, but only because of a coincidence rather than an enforced
control.

**Fix recommendation.** Add `intent-tick.json` to `DENY_LIST` with a
descriptive `deny_rule: "intent-tick.json"` and a message explaining that
the tick counter is internal to drift detection. Also add `intent.md` (which
has its own deny-list entry) — and once Option A is implemented (R-01 fix
spawns a session table or per-reviewer record) those should land on deny-
list at definition time.

---

## R-07 (MED) — Audit-log line-count is not the same as audit-log entry count under crash; entry_id sequence drifts on partial writes

**Files**

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:63-73` (`getNextAuditSequenceNumber`)
- `packages/haiku/src/orchestrator/workflow/write-audit.ts:156-...` (`appendWriteAudit`)

**Attack narrative.** `getNextAuditSequenceNumber` derives the next sequence
number from `content.split("\n").filter(...)`. If a previous append crashed
mid-line (writer killed between `write()` and the trailing `\n` flush), the
file ends with a malformed half-line. The line count is now ambiguous —
`split("\n")` returns a trailing fragment that isn't a real entry. Two
problems:

1. The next sequence number is off-by-one (counts the half-line as an
   entry), so `entry_id` skips a number.
2. Worse: if the half-line was truncated to an empty trailing line by the
   filter, the next entry overwrites... no, wait — `appendWriteAudit` uses
   O_APPEND so no overwrite. But the JSONL parse downstream
   (`readActionLogSync` line 798: `for (const line of raw.split("\n"))`)
   silently skips the malformed line via `try/catch` — losing the
   `human-via-mcp` provenance for whichever audit entry got truncated.

This isn't a V-03 attribution-binding bug per se but it's adjacent: the unit's
out-of-scope deferral of audit-log hash-chaining (V-03 fix #3) explicitly
relies on the audit log being durable and complete. A truncated tail line
breaks both the hash chain (when it eventually lands) and the current
attribution lookup.

**Precondition.** MCP server killed mid-write (SIGKILL, OOM, container
eviction). Probabilistic — but in long-running operator sessions with many
audit lines, the probability is non-zero.

**Fix recommendation.** Audit-log writers should write to a tempfile and
rename, OR use O_APPEND with `\n` written FIRST (so a partial write yields a
trailing newline + partial JSON, not partial JSON + missing newline — the
parser then skips the partial JSON line and the count stays accurate). Same
fix applies to `action-log.jsonl`.

This finding is intentionally on the boundary of the unit-02 scope; raising
it here so the security-engineer can decide whether to land the fix or carry
it forward to unit-04 ASSESSMENTS residual risk alongside V-03 fix #3.

---

## R-08 (LOW) — `isIntentLocked` / `isIntentArchived` swallow ALL parse errors; an attacker who corrupts intent.md frontmatter unlocks the intent

**Files**

- `packages/haiku/src/state-tools.ts:2059-2069` (`isIntentLocked`)
- `packages/haiku/src/state-tools.ts:2074-2085` (`isIntentArchived`)

**Attack narrative.** Both helpers wrap the `gray-matter` call in try/catch
and return `false` on any parse failure. The comment explicitly notes
"callers treat unknown state as 'not locked / not archived'" — fail-open
semantics. If an attacker can corrupt `intent.md` (e.g. via a path-traversal
exploit elsewhere, or a partial commit, or a YAML-syntax-breaking write),
the lock is effectively cleared.

The competing failure mode (fail-closed) would block legitimate writes when
the intent.md frontmatter is malformed. The unit chose fail-open for
operability — that's defensible for this surface, but it should be
explicitly logged at WARN/ERROR so operators see the parse failure. Today
the parse error is silently swallowed.

**Precondition.** Attacker corrupts `intent.md` frontmatter in a way that
fails YAML parse. Out-of-band-modification surface itself enables this
(write `intent.md` via... actually intent.md is on the deny-list. So this
requires an out-of-band file modification OUTSIDE the haiku_human_write
flow — git push, manual edit, etc.).

**Fix recommendation.** Log parse failures via the existing telemetry surface
(`emitTelemetry("haiku.intent.parse_failure", { intent, reason: ... })`).
Fail-open semantics stay; observability of the failure becomes mandatory.
Lower priority than R-01 / R-02 / R-03 — log this in unit-04 residual risk
if not addressed inline.

---

## R-09 (LOW) — Status check is case-sensitive on the YAML key (`Status:` vs `status:`)

**Files**

- `packages/haiku/src/state-tools.ts:2065, 2081` (lookups by exact key name)

**Attack narrative.** `gray-matter` preserves YAML key case. The helpers
look up `(data as Record<string, unknown>).status` exactly. An intent.md
written with `Status: locked` (capitalized — common from operators copy-
pasting from prose docs that use sentence case) would parse cleanly but
fail the lock check. False negative: intent appears unlocked when the
operator clearly intended otherwise.

This is a defense-in-depth gap rather than an exploit primitive; but it's
on the same line as the V-06 fix and trivial to address via a normalize
step. Same applies to `Archived` / `archived: True` (Python-style) /
`archived: 1` — `=== true` rejects anything that isn't strictly the
boolean.

**Fix recommendation.** Normalize before comparison:

```ts
const status = String(fm.status ?? "").toLowerCase()
return status === "locked"
```

For the boolean: `fm.archived === true || fm.archived === "true" || fm.archived === 1`
(or use a small `parseBool` helper).

**Test gap.** None of the V-06 helper tests use a capitalized key or a
non-canonical boolean form.

---

## Summary table — what to fix, where to fix it, in which order

| ID | Sev  | Surface          | Fix location                                         | Required for unit-02 to be defensibly closed? |
|----|------|------------------|------------------------------------------------------|-----------------------------------------------|
| R-01 | HIGH | SPA auth         | `upload-routes.ts:214, 497` add `verifyFeedbackMutationAuth` | YES — V-03 attribution binding is meaningless without intent-scoping the auth |
| R-02 | HIGH | MCP V-05         | `haiku_human_write.ts:653` mirror SPA tick branch    | YES — V-05 spec required producer fix on BOTH SPA and MCP |
| R-03 | HIGH | MCP V-06         | `haiku_human_write.ts:414` add `isIntentLocked` guard | YES — V-06 spec required shared-helper coverage on BOTH surfaces |
| R-04 | HIGH | DoS              | `upload-routes.ts:202-207` cap `fieldSize`; validate `attribute_to_user` length & charset on both surfaces | NO — risk-accept with cap or carry to unit-04 |
| R-05 | MED  | Cross-proc race  | `state-tools.ts:2173` add file lock                  | NO — document in residual risk if multi-MCP not in scope |
| R-06 | MED  | Deny-list gap    | `haiku_human_write.ts:79` add `intent-tick.json`     | NO — defense-in-depth, easy add |
| R-07 | MED  | Crash durability | `write-audit.ts` newline-first or tempfile-rename    | NO — pair with V-03 fix #3 deferral |
| R-08 | LOW  | Fail-open quiet  | `state-tools.ts:2066, 2082` add telemetry            | NO — observability, not control |
| R-09 | LOW  | YAML normalisation | `state-tools.ts:2065, 2081` normalise case + bool forms | NO — same edit window as R-08 |

R-01, R-02, R-03 directly contradict the unit spec's mitigation requirements
and should land before unit-02 advances. The remaining findings are
reasonable carry-forward to unit-04 ASSESSMENTS residual risk alongside V-03
fix #3 (audit-log hash-chaining) and V-03 Option A (server-resolved
identity) — but R-04 is on the borderline since it's exploitable today.

---

## Out-of-scope / sibling-unit boundaries respected

- **V-01, V-02** (sibling unit-01) — not reviewed.
- **V-04, V-07, V-08** (sibling unit-03) — not reviewed.
- **V-09, V-10, V-11** (unit-04 residual risk) — not reviewed.
- **V-03 fix #3** (audit-log hash-chaining) — explicitly deferred per spec; R-07 here is an adjacent finding the security-engineer should pair with that future work.
- **V-03 Option A** (server-resolved reviewer identity) — explicitly deferred per spec; R-01 fix would land tightly after Option A is implemented (the session table is the natural place to bind `intent_slug` for upload-route auth).

## How this report was produced

Read of every changed file in commits `30a696f04`, `399c2ee13`, `94588f783`
plus the existing call-paths each new helper participates in:
`upload-routes.ts`, `auth.ts`, `feedback-api.ts`, `state-tools.ts`,
`haiku_human_write.ts`, `drift-baseline.ts`, `drift-detection-gate.ts`,
`write-audit.ts`, `action-log.ts`. No payloads were executed against a
running server (red-team rule: do not execute destructive payloads in shared
environments). Each finding cites a code-level inspection result reproducible
from the same files.
