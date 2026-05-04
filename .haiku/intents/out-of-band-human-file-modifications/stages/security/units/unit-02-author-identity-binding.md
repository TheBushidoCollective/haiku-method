---
title: >-
  Bind human author identity from authoritative source; correct status checks
  (V-03, V-05, V-06)
depends_on: []
inputs:
  - .haiku/intents/out-of-band-human-file-modifications/knowledge/VULN-REPORT.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/agent-writes-on-behalf-of-human.feature
  - packages/haiku/src/state-tools.ts
  - packages/haiku/src/http/upload-routes.ts
  - packages/haiku/src/http/feedback-api.ts
  - packages/haiku/src/http/auth.ts
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
outputs:
  - stages/security/artifacts/THREAT-MODEL-unit-02.md
  - stages/security/artifacts/SECURITY-ASSESSMENT-unit-02.md
  - packages/haiku/src/http/upload-routes.ts
  - packages/haiku/src/orchestrator/workflow/drift-baseline.ts
  - packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
  - packages/haiku/src/orchestrator/workflow/write-audit.ts
  - packages/haiku/src/state-tools.ts
  - packages/haiku/src/tools/orchestrator/haiku_human_write.ts
  - packages/haiku/test/autopilot-mode.test.mjs
  - packages/haiku/test/drift-detection-gate.test.mjs
  - packages/haiku/test/state-tools-handlers.test.mjs
  - packages/haiku/test/upload-routes.test.mjs
  - plugin/studios/software/stages/security/outputs/security-fix.md
  - stages/security/artifacts/RED-TEAM-unit-02.md
  - stages/security/artifacts/BLUE-TEAM-unit-02.md
  - packages/haiku/src/http/auth.ts
  - packages/haiku/test/haiku-human-write.test.mjs
  - packages/haiku/test/upload-routes-strict-auth.test.mjs
model: sonnet
quality_gates:
  - name: v03-spa-author-bound-from-session-or-renamed
    command: >-
      bash -c 'grep -qE
      "reqUser|sessionUser|claims\\.sub|resolveAuthorFromSession"
      packages/haiku/src/http/upload-routes.ts || grep -qE "claimed_author_id"
      packages/haiku/src/state-tools.ts'
  - name: v03-mcp-author-bound-from-os-user-or-renamed
    command: >-
      bash -c 'grep -qE "os\\.userInfo|process\\.env\\.USER"
      packages/haiku/src/state-tools.ts || grep -qE "claimed_author_id"
      packages/haiku/src/state-tools.ts'
  - name: v03-author-mismatch-rejected-test-named
    command: >-
      grep -qE 'unauthorized.*author|author.*mismatch.*reject|claimed_author_id'
      packages/haiku/test/state-tools-handlers.test.mjs
  - name: v05-intent-scope-tick-counter
    command: >-
      grep -qE 'getIntentScopeTickCounter|globalTickCounter|intentScopeTick'
      packages/haiku/src/state-tools.ts
  - name: v05-drift-gate-unions-stage-and-intent-action-log
    command: >-
      grep -qE
      'intentScopeActionLog|readActionLogForIntent|union.*action.*log|intent.*scope.*lookup'
      packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
  - name: v06-frontmatter-parser-not-substring
    command: >-
      bash -c '! grep -qE "raw\\.includes\\(\\\"status:"
      packages/haiku/src/http/upload-routes.ts'
  - name: v06-no-substring-status-checks-anywhere
    command: >-
      bash -c '! rg -nE "raw\\.includes\\(\"status:" packages/haiku/src
      2>/dev/null'
  - name: v06-shared-locked-archived-helper
    command: >-
      grep -qE 'isIntentLocked|isIntentArchived'
      packages/haiku/src/state-tools.ts
  - name: haiku-suite-passes
    command: bun run --cwd packages/haiku test
status: completed
bolt: 1
hat: blue-team
started_at: '2026-05-03T02:09:53Z'
hat_started_at: '2026-05-03T02:59:28Z'
iterations:
  - hat: threat-modeler
    started_at: '2026-05-03T02:09:53Z'
    completed_at: '2026-05-03T02:13:34Z'
    result: advance
  - hat: security-engineer
    started_at: '2026-05-03T02:13:34Z'
    completed_at: '2026-05-03T02:40:16Z'
    result: advance
  - hat: security-reviewer
    started_at: '2026-05-03T02:40:16Z'
    completed_at: '2026-05-03T02:51:12Z'
    result: advance
  - hat: red-team
    started_at: '2026-05-03T02:51:12Z'
    completed_at: '2026-05-03T02:59:28Z'
    result: advance
  - hat: blue-team
    started_at: '2026-05-03T02:59:28Z'
    completed_at: '2026-05-03T08:14:33Z'
    result: advance
completed_at: '2026-05-03T08:14:33Z'
---
# Unit 02 — Author identity binding + status-check correctness

## Scope

Close three vuln-report findings about authentication/integrity in the human-attribution and SPA upload paths:

- **V-03 (MED)** `human_author_id`, `attribute_to_user`, `rationale`, `user_instruction_excerpt` are self-reported by the agent and copied into `write-audit.jsonl` and `action-log.jsonl` with no JWT cross-check.
- **V-05 (MED)** `getCurrentTickCounter(intentDir)` for `stage=null` SPA uploads picks a non-deterministic stage's iteration; entry-IDs collide and drift gate's per-tick action-log lookup misses.
- **V-06 (MED)** SPA archived/locked checks use `raw.includes("status: locked")` substring match — false-positives on body content, false-negatives on `status: 'locked'`.

## V-03 mitigation — explicit decision required (the spec was wrong before)

Pre-execute review flagged that "JWT claims" was hand-waved for SPA and that the MCP path has no JWT at all. Fix: pick ONE of these two paths AND apply consistently to both surfaces:

**Option A — Resolve to a real reviewer identity:**
- SPA path: extend session bootstrap to capture a reviewer email/handle into the session table keyed by `sid`. `resolveAuthorFromSession(sid)` returns the email; `human_author_id` is set from the resolved value, agent-supplied values rejected with `unauthorized_author_attribution`.
- MCP path: derive from `os.userInfo().username` (Claude Code runs as the local user). Same rejection on agent override.

**Option B — Rename the field to reflect reality:**
- Rename `human_author_id` → `claimed_author_id` everywhere it's persisted (audit logs, classification records, SPA UI). Stop pretending it's authoritative; this matches VULN-REPORT V-03 fix #2.

The implementer picks A or B based on whether reviewer email/identity actually exists today. The frontmatter gates accept either — the unit is closed when one path is consistently applied to both SPA and MCP surfaces.

**Out-of-scope deferred to unit-04 ASSESSMENTS.md residual risk:** audit-log hash-chaining (VULN-REPORT V-03 fix #3). This is integrity-on-the-log-itself defense-in-depth, separate from attribution binding. Unit-04 MUST file a `stage_revisit` FB tagged "follow-up: audit-log hash-chaining" and document V-03 as "partially closed (attribution bound; integrity deferred)".

## V-05 mitigation — both producer AND consumer fix required

Pre-execute review flagged that the producer-side counter fix isn't enough — the drift-gate consumer must learn the new key shape too:

1. **Producer**: `getIntentScopeTickCounter(intentDir)` returns a deterministic intent-scope counter when `stage === null`. SPA uploads with no stage write entries with this counter.
2. **Consumer**: `drift-detection-gate.ts` action-log lookup unions per-stage and intent-scope entries when classifying any tracked file, so SPA uploads at intent.iteration=N appear as `human-via-mcp` on a drift-gate tick fired from stage X with stage.iteration=M.

## V-06 mitigation — repo-wide cleanup, shared helper

1. Replace `raw.includes("status: locked")` substring patterns with `gray-matter` parsing in `upload-routes.ts`.
2. Centralize: add `isIntentLocked(intentDir)` / `isIntentArchived(intentDir)` helpers in `state-tools.ts`. Both `upload-routes.ts` and `haiku_human_write` (state-tools.ts) call the shared helper. The frontmatter gate `v06-no-substring-status-checks-anywhere` asserts repo-wide elimination of the anti-pattern.

## Completion criteria

See `quality_gates:` in frontmatter. Each finding has at least one executable gate. Plus full `bun run --cwd packages/haiku test` passes.

## References

- VULN-REPORT.md V-03, V-05, V-06
- `packages/haiku/src/state-tools.ts` (haiku_human_write, haiku_classify_drift, append-audit/action-log helpers)
- `packages/haiku/src/http/upload-routes.ts`, `feedback-api.ts`, `auth.ts`
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` (action-log consumer)
