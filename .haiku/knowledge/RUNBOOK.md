# Remote Review — Runbook

## Feature Flag

Toggle remote review: `export HAIKU_REMOTE_REVIEW=1`
Disable (revert to local SPA): unset or `export HAIKU_REMOTE_REVIEW=0`

## Common Failure Modes

### Tunnel fails to open
**Symptom:** "Failed to open localtunnel after 3 attempts" error in MCP logs
**Cause:** localtunnel.me public relay is down or rate-limiting
**Fix:** Retry later. If persistent, check https://github.com/localtunnel/localtunnel/issues for outages. Fallback: unset `HAIKU_REMOTE_REVIEW` to use local SPA.

### Review page shows "Connection Failed"
**Symptom:** Website shows error card with "Can't reach the review session"
**Cause:** Tunnel died or MCP stopped after generating the URL
**Fix:** User requests a new link from Claude Code (re-triggers the review flow)

### Review page shows "Review Link Expired"
**Symptom:** Website shows expiry error
**Cause:** JWT has 1-hour TTL and it's past expiry
**Fix:** User requests a new link from Claude Code

### WebSocket disconnects during review
**Symptom:** Amber "Reconnecting..." banner appears
**Cause:** Tunnel instability or network blip
**Resolution:** Auto-reconnects every 3s, up to 5 attempts. If all fail, shows persistent error. User may need a new link.

### CORS errors in browser console
**Symptom:** Fetch/XHR blocked by CORS policy
**Cause:** `HAIKU_REMOTE_REVIEW` not set, or MCP not running the CORS-enabled version
**Fix:** Ensure `HAIKU_REMOTE_REVIEW=1` is set and MCP is running the updated build

## Deployment

**Website:** Deploys automatically on push to main via `deploy-website.yml`. No manual steps.
**MCP Plugin:** Ships with plugin release pipeline. `bun run build` in `packages/haiku/` produces the binary.

## Monitoring

- **Website errors:** Sentry project `haiku-spa` (via @sentry/nextjs)
- **MCP errors:** Sentry project `haiku-mcp`
- **Tunnel health:** No dedicated monitoring — localtunnel is ephemeral per session
- **Drift detection telemetry:** OTLP events `haiku.drift.*` and `haiku.reconciliation.*` — see SLOs in `deploy/operations/drift-detection-slos.yaml` and alert routing in `deploy/operations/drift-detection-alerts.yaml`.

---

# Drift Detection — Operational Runbook

This section covers failure modes for the out-of-band human file modification feature: drift detection (`drift-detection-gate.ts`), upstream reconciliation (`upstream-reconciliation.ts`), and the runtime PII gate (`telemetry.ts`). Each entry maps to an alert in `deploy/operations/drift-detection-alerts.yaml`.

**What "healthy" looks like (define before unhealthy):**
- `haiku.drift.gate.tick` fires on every `haiku_run_next` tick.
- `haiku.drift.gate.duration_ms` p95 < 500ms over 7d.
- Zero `haiku.drift.baseline.corrupt`, zero `haiku.drift.baseline.write_failed`, zero `pii.deny.strip` events.
- `haiku.drift.surface.size` stable per intent (slow growth as new files are added is fine).
- `haiku.reconciliation.fingerprint.matched` dominates `haiku.reconciliation.fingerprint.drifted` (drift is the exception, not the rule).

## Triage Quick-Reference (oncall: read first)

Use this table when an alert wakes you up. The "first action" column is the single first command to run before anything else — it answers "is this real?" or "what intent is bleeding?". Then jump to the linked section for full diagnosis + remediate steps.

| Alert ID | Severity | Cause class | First action (run this first) | Section |
|---|---|---|---|---|
| `drift-baseline-corrupt` | page | per-intent FS corruption | Read `intent_slug` + `stage` from the alert label set; `cat .haiku/intents/<slug>/stages/<stage>/baseline.json \| jq .` | [drift-gate-baseline-corrupt](#drift-gate-baseline-corrupt) |
| `drift-baseline-write-failed` | page | FS write fault (disk/permission/RO-FS) | `df -h .haiku && touch .haiku/.write-test && rm .haiku/.write-test` | [drift-gate-write-failed](#drift-gate-write-failed) |
| `reconciliation-write-failed` | page | FS write fault (state.json) | Same FS triage as above; cross-check whether `drift-baseline-write-failed` also fires (FS-wide vs single-stage) | [reconciliation-write-failed](#reconciliation-write-failed) |
| `pii-deny-list-strip` | page | privacy regression — body content reached telemetry | Identify the stripped key from the alert label `key`; `grep -rn "$KEY" packages/haiku/src/` to find emit site | [pii-deny-list-strip](#pii-deny-list-strip) |
| `drift-availability-fast-burn` | page | sustained gate-tick failure budget burn | Group `haiku.drift.baseline.corrupt` + `.write_failed` by `intent_slug` to find top offender | [drift-gate-availability-burn](#drift-gate-availability-burn) |
| `baseline-write-budget-fast-burn` | page | sustained baseline-write failure budget burn | Same FS triage as `drift-baseline-write-failed`; if FS healthy, look for permission-mode regression | [baseline-write-budget-burn](#baseline-write-budget-burn) |
| `drift-availability-slow-burn` | ticket | budget eroding (investigate this week) | Pull 24h trend of `haiku.drift.baseline.corrupt` + `.write_failed` per intent | [drift-gate-availability-burn](#drift-gate-availability-burn) |
| `baseline-write-budget-slow-burn` | ticket | baseline-write budget eroding | Same | [baseline-write-budget-burn](#baseline-write-budget-burn) |
| `drift-gate-latency-p95-high` | ticket | surface scan slow OR FS slow | Group `haiku.drift.surface.size` by intent; correlate with `haiku.reconciliation.fingerprint.duration_ms` | [drift-gate-latency-high](#drift-gate-latency-high) |
| `reconciliation-fingerprint-latency-p95-high` | ticket | corpus growth | Group `haiku.reconciliation.corpus.bytes` by intent | [reconciliation-latency-high](#reconciliation-latency-high) |
| `drift-surface-oom-synthetic` | ticket | intent surface exceeded in-memory threshold | Read `intent_slug` + `stage`; check `du -sh .haiku/intents/<slug>/stages/<stage>/` | [drift-oom-synthetic](#drift-oom-synthetic) |
| `kill-switch-engaged` | ticket | manual disable in effect | `env \| grep HAIKU_DRIFT` to confirm; check who set it via dotenv git log | [kill-switch-engaged](#kill-switch-engaged) |
| `drift-markers-stale-burst` | info | churn pattern (no immediate action) | Group `haiku.drift.markers.stale_removed` by intent; usually a tool/formatter tic | [drift-markers-churn](#drift-markers-churn) |
| `assessments-zero-completion` | info | dispatch/resolution loop telemetry gap | Find unresolved files: `find .haiku/intents/*/stages/*/drift-assessments -type f -newer /tmp/.6h-ago` | [assessments-stuck](#assessments-stuck) |

**Rules of the road:**
- **Page-severity alerts always name a cause, never a symptom.** If you wake up to a page, the alert title tells you the fault class — go straight to the "First action" column.
- **Burn-rate pages mean budget is bleeding.** They will not clear on their own. Triage the underlying cause-based alert that's tipping the budget (the linked section calls it out).
- **Tickets do not page anyone.** Triage during business hours; same-day for fast-burn tickets, end-of-week for slow-burn / saturation tickets.
- **Info alerts are conversation starters.** They go to `#haiku-ops` and exist to prevent a future ticket from surprising you. Do not action them blindly.

## drift-gate-baseline-corrupt

**Symptom:** Alert `drift-baseline-corrupt` fires. Event `haiku.drift.baseline.corrupt` shows non-zero count. One or more intents stop emitting `haiku.drift.gate.tick`.

**Cause:** `.haiku/intents/<slug>/stages/<stage>/baseline.json` failed JSON parse or schema validation.

**Diagnose (specific commands):**

```bash
# 1. Identify the affected intent + stage from event attributes
#    (intent_slug, stage are in every emit per gateAttrs())
INTENT="<slug-from-event>"
STAGE="<stage-from-event>"
BASELINE=".haiku/intents/${INTENT}/stages/${STAGE}/baseline.json"

# 2. Confirm the file is invalid
cat "$BASELINE" | jq . || echo "JSON parse failed"
ls -lh "$BASELINE"  # check size — zero-byte means write was interrupted

# 3. Check disk + permissions
df -h .haiku
ls -la "$(dirname "$BASELINE")"
```

**Remediate (specific commands):**

```bash
# Path A: file is recoverable from git (preferred)
git log -- "$BASELINE" | head
git checkout HEAD -- "$BASELINE"

# Path B: file is unrecoverable — re-establish baseline on next tick
mv "$BASELINE" "${BASELINE}.corrupt.$(date +%s)"
# Next haiku_run_next will emit haiku.drift.baseline.established and
# treat the current surface as the new baseline. Any drift between the
# corrupt state and now is lost — this is acceptable; the alternative is
# blocking the gate indefinitely.
```

**Escalation:** If `haiku.drift.baseline.corrupt` fires for >3 distinct intents in 1h, suspect filesystem corruption — page the storage oncall and stop further `haiku_run_next` ticks via the kill switch (see `kill-switch-engaged` below).

**Rollback:** N/A — re-establishing the baseline is forward-only. The previous corrupt baseline is preserved as `.corrupt.<ts>` for forensics.

## drift-gate-write-failed

**Symptom:** Alert `drift-baseline-write-failed` fires. Event `haiku.drift.baseline.write_failed` shows non-zero count. The gate now rethrows on write failure (post-2026-05-01 fix); pre-fix the failure was silently swallowed and stale baselines persisted forever.

**Cause:** Filesystem write to `baseline.json` failed — disk full, EACCES, EROFS, filesystem corruption, or quota exhaustion.

**Diagnose (specific commands):**

```bash
# 1. Disk space + inodes
df -h .haiku
df -i .haiku

# 2. Permission + ownership on the intent dir
ls -la .haiku/intents/<slug>/stages/<stage>/

# 3. Read-only filesystem? (common after disk-full recovery)
touch .haiku/.write-test && rm .haiku/.write-test && echo "writable" || echo "READ-ONLY"

# 4. SELinux / AppArmor denying writes?
[ -f /var/log/audit/audit.log ] && grep "denied" /var/log/audit/audit.log | tail
```

**Remediate (specific commands):**

```bash
# Disk full:
du -sh .haiku/intents/*/stages/*/drift-assessments/ | sort -h | tail
# Old assessments are safe to archive/remove if disk pressure is real.

# Permission:
chmod -R u+w .haiku/intents/<slug>/

# Read-only FS:
mount -o remount,rw <mount-point>
```

**Escalation:** If write_failed events span >5 intents and persist after recovery, escalate to infra oncall.

**Rollback:** N/A — gate writes are idempotent. Resume the gate by ensuring the FS is writable; next tick succeeds automatically.

## reconciliation-write-failed

**Symptom:** Alert `reconciliation-write-failed` fires. Event `haiku.reconciliation.fingerprint.write_failed` shows non-zero count.

**Cause:** Failure persisting `upstream_reconciliation_fingerprint` to `state.json`. Same fault class as drift-baseline-write-failed.

**Diagnose:** Same disk/permission/FS checks as drift-gate-write-failed, but the file is `.haiku/intents/<slug>/stages/<stage>/state.json`.

**Remediate:** Same FS recovery steps. Once writable, the next tick re-establishes the fingerprint via `haiku.reconciliation.fingerprint.established`.

**Escalation:** Cross-correlate with drift-baseline-write-failed — if both fire for the same intent, root cause is FS-wide; escalate to infra oncall, kill-switch the affected host.

## pii-deny-list-strip

**Symptom:** Alert `pii-deny-list-strip` fires. Stderr from MCP shows `[haiku/telemetry] PII deny-list stripped attribute "<key>" from event "<name>"`. Backend metric `pii.deny.strip` (scraped from stderr) is non-zero.

**Cause:** A code path attempted to emit a body-shaped attribute (`diff_unified`, `excerpt`, `*_body`, `content`, etc.) into telemetry. Runtime gate caught it; static CI gate (`pii-grep-gate-runs`) did not.

**Diagnose (specific commands):**

```bash
# 1. Find the emit site from the warned key + event name
KEY="<key-from-warning>"
EVENT="<event-name-from-warning>"
grep -rn "emitTelemetry(\"$EVENT\"" packages/haiku/src/

# 2. Check whether the static-gate test should have caught this
grep -rn "$KEY" packages/haiku/test/telemetry-otel.test.mjs

# 3. Confirm runtime sanitization is functioning
node -e 'import("./packages/haiku/src/telemetry.ts").then(t => console.log([...t.__test.piiDenyKeys]))'
```

**Remediate (specific commands):**

```bash
# Fix the emit site: replace body-shaped attribute with a hash, byte
# count, or path. Example diff:
#   - { diff_unified: diffText }
#   + { diff_bytes: String(Buffer.byteLength(diffText, "utf8")) }
#
# Then add the offending key to the static CI gate so it can never
# reach runtime again:
$EDITOR packages/haiku/test/telemetry-otel.test.mjs
# (add to the PII deny-list assertion)
```

**Escalation:** If multiple distinct keys strip in <1h, treat as a privacy incident: stop telemetry export (`HAIKU_TELEMETRY_DISABLE=1`), page security, and audit the OTLP backend's last 24h of events for the leaked keys.

**Rollback:** Telemetry events are append-only and may be in the backend already. If a leak is confirmed, contact the OTLP backend admin to purge events matching the offending keys; revert the regressing PR.

## drift-gate-availability-burn

**Symptom:** Alert `drift-availability-fast-burn` (page) or `drift-availability-slow-burn` (ticket) fires. SLO `drift-gate-availability` budget is burning.

**Cause:** Sustained ratio of `baseline.corrupt + baseline.write_failed` to `gate.tick` is above the SLO objective.

**Diagnose:**

```bash
# 1. Which intent(s) are dragging the budget?
#    Group `haiku.drift.baseline.corrupt` and `.write_failed` by intent_slug
#    in your OTLP backend. The top offender is the host of the issue.

# 2. Is it a single intent flapping (look at distinct `tick_iteration`
#    values) or is it FS-wide (correlate with reconciliation events)?
```

**Remediate:**
- Single intent flapping: see `drift-gate-baseline-corrupt` runbook above.
- FS-wide: see `drift-gate-write-failed` runbook above.

**Escalation:** Fast-burn that doesn't clear within 30 min → consider engaging kill switch to stop the budget bleed while you investigate (`HAIKU_DRIFT_GATE_DISABLED=1`).

**Rollback:** Re-enable the gate (`unset HAIKU_DRIFT_GATE_DISABLED`) once the underlying cause is fixed and `gate.tick` events resume cleanly for 1h.

## baseline-write-budget-burn

**Symptom:** Alert `baseline-write-budget-fast-burn` (page) or `baseline-write-budget-slow-burn` (ticket) fires. SLO `baseline-write-error-rate` budget is burning.

**Cause:** Sustained ratio of `haiku.drift.baseline.write_failed` to `haiku.drift.gate.tick` exceeds the SLO objective (1% of ticks may fail in a 28d window). Same fault class as `drift-gate-write-failed` but observed in aggregate over a budget window.

**Diagnose:**

```bash
# 1. Which intents are bleeding the budget?
#    Group `haiku.drift.baseline.write_failed` by intent_slug + stage in your
#    OTLP backend. Top offenders are the cause.

# 2. Is the FS the cause, or per-intent corruption?
#    Cross-correlate with `reconciliation-write-failed`:
#    - both firing for same intent → per-intent corruption
#    - both firing across many intents → FS-wide

# 3. Confirm gate.tick rate is stable
#    If gate.tick rate dropped, the ratio is misleading — the cause may be
#    a stalled tick loop, not write failures.
```

**Remediate:**
- Per-intent corruption (single intent dragging the budget): see [drift-gate-write-failed](#drift-gate-write-failed) for that intent.
- FS-wide: see [drift-gate-write-failed](#drift-gate-write-failed) for the host-level FS recovery.
- Permission-mode regression (recent change to ownership/umask): `chmod -R u+w .haiku/intents/<slug>/` on the affected intents and audit the regression source.

**Escalation:** Fast-burn that doesn't clear within 30 min after recovery → engage kill switch (`HAIKU_DRIFT_GATE_DISABLED=1`) on the affected host to stop the budget bleed while you root-cause.

**Rollback:** Re-enable the gate (`unset HAIKU_DRIFT_GATE_DISABLED`) once write_failed events have stopped for 1h.

## drift-gate-latency-high

**Symptom:** Alert `drift-gate-latency-p95-high` fires. p95 of `haiku.drift.gate.duration_ms` exceeds 500ms over 1h.

**Cause:** Surface scan slowdown. Correlate with `haiku.drift.surface.size` to distinguish corpus growth from filesystem slowdown.

**Diagnose:**

```bash
# 1. Surface size growth pattern — is it a few intents or all of them?
#    Group `haiku.drift.surface.size` by intent_slug, plot trend over 7d.

# 2. Filesystem-side slowdown? Compare against
#    haiku.reconciliation.fingerprint.duration_ms — if both climbed
#    together, FS is the cause; if only drift gate climbed, surface
#    growth is the cause.

# 3. Identify hot intents
#    Sort intents by haiku.drift.surface.size descending; the top 5%
#    likely produce the bulk of the latency.
```

**Remediate:**
- Surface growth: most often a knowledge dir bloating with binary attachments. Check `.haiku/intents/<slug>/knowledge/attachments/` and consider archive policy.
- FS slowdown: triage with `iostat` / `vmstat`; engage infra oncall.

**Rollback:** N/A — latency degradation is gradual; no atomic action to revert.

## reconciliation-latency-high

**Symptom:** Alert `reconciliation-fingerprint-latency-p95-high` fires.

**Cause:** Upstream corpus byte volume exceeded what content-hashing can do in 750ms p95. Correlate with `haiku.reconciliation.corpus.bytes`.

**Diagnose:** Group `haiku.reconciliation.corpus.bytes` by intent. The largest corpora drive the latency.

**Remediate:** Same archive/cleanup pattern as drift-gate-latency-high. Long-term: consider hashing only summary metadata (file count + mtime aggregate) instead of full content for corpora >10MB; track as a follow-up issue, not an emergency.

**Rollback:** N/A.

## drift-oom-synthetic

**Symptom:** Alert `drift-surface-oom-synthetic` fires. Event `haiku.drift.baseline.oom_synthetic` shows non-zero count.

**Cause:** Surface size for an intent exceeded the in-memory baseline threshold. Gate downgraded to one synthetic finding per stage. Detection still works; per-file fidelity is lost.

**Diagnose:**

```bash
# 1. Which intent + stage tripped the threshold?
#    `haiku.drift.baseline.oom_synthetic` carries intent_slug + stage.
#
# 2. What is the surface size for that intent/stage?
#    `haiku.drift.surface.size` gives the count.
```

**Remediate:**
- If the intent has accumulated cruft (old assessments, archived attachments), prune.
- If the intent is genuinely large, the synthetic baseline is correct behavior — no action. The user will see one finding per stage instead of one per file; they can drill into git for details.

**Escalation:** If >3 intents cross the threshold in a week, the in-memory threshold itself may need raising. File a follow-up issue; do not page.

**Rollback:** N/A.

## drift-markers-churn

**Symptom:** Alert `drift-markers-stale-burst` fires (info-only).

**Cause:** Humans are touching files and reverting, OR an upstream tool (formatter, linter, git rebase) is churning the surface.

**Diagnose:**

```bash
# 1. Group `haiku.drift.markers.stale_removed` by intent + stage.
# 2. Inspect git history of the affected files for a churn pattern.
```

**Remediate:** Usually no action — informational. If a specific tool is the culprit (e.g., a pre-commit hook re-writing files unnecessarily), tune the tool or add the file path to the surface ignore list (TBD — currently no per-path ignore).

**Rollback:** N/A.

## kill-switch-engaged

**Symptom:** Alert `kill-switch-engaged` fires. Event `haiku.drift.gate.kill_switch_hit` shows non-zero count.

**Cause:** `HAIKU_DRIFT_GATE_DISABLED=1` (or equivalent) is set in the MCP environment. Detection is OFF.

**Diagnose:**

```bash
# 1. Confirm the kill switch is set
env | grep HAIKU_DRIFT
# 2. Check who set it and when
#    `git log` on the dotenv / launcher script that exports it.
```

**Remediate:**

```bash
# When the underlying cause is resolved:
unset HAIKU_DRIFT_GATE_DISABLED
# Or remove the export from the launcher.
# Restart MCP. Next tick should emit haiku.drift.gate.tick instead of
# kill_switch_hit.
```

**Escalation:** If the kill switch has been on for >24h without a follow-up issue tracking the resolution, file an issue and tag the person who set it. Long-running kill switches mask other problems.

**Rollback:** Re-engage the kill switch if a regression appears immediately after re-enabling.

## assessments-stuck

**Symptom:** Alert `assessments-zero-completion` fires (info, possible false-positive).

**Cause:** Drift assessments dispatched (`haiku.drift.assessments.count` ticked up) but the agent didn't emit a corresponding resolution event. Possible loop, stuck agent, or missing resolution telemetry.

**Diagnose:**

```bash
# 1. List unresolved assessments
find .haiku/intents/*/stages/*/drift-assessments -type f -newer /tmp/.6h-ago

# 2. Check the agent's recent run-tick output for a stuck loop
tail -200 ~/.claude/logs/mcp.log | grep manual_change_assessment
```

**Remediate:** Agent intervention — instruct the agent to resolve the open assessment (`haiku_run_next` should pick it up). If the agent loops indefinitely, manually move the assessment file to `.resolved-manual/<ts>/` and document the case as a follow-up.

**Note:** This alert depends on a `haiku.drift.assessments.resolved` event that does not yet exist. Marked as a telemetry coverage gap for a future unit.

**Escalation:** If assessments accumulate across many intents (>20 unresolved over 24h), the dispatch-vs-resolution loop is likely broken — file an incident.

**Rollback:** N/A.
