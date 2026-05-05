---
title: SPA upload + assessments HTTP endpoints
model: sonnet
depends_on:
  - unit-01-baseline-storage
  - unit-03-write-audit-log
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - stages/design/artifacts/ARCHITECTURE.md
  - stages/design/DESIGN-BRIEF.md
  - product/ACCEPTANCE-CRITERIA.md
  - product/DATA-CONTRACTS.md
  - features/explicit-spa-upload.feature
  - features/drift-assessment-visibility.feature
outputs:
  - packages/haiku/src/http/upload-routes.ts
  - packages/haiku/src/http/assessments-routes.ts
  - packages/haiku/src/http/default-routes.ts
  - packages/haiku/test/upload-routes.test.mjs
  - packages/haiku/test/assessments-routes.test.mjs
quality_gates:
  - name: biome
    command: >-
      bunx biome check packages/haiku/src/http/upload-routes.ts
      packages/haiku/src/http/assessments-routes.ts
  - name: typecheck
    command: bun run --cwd packages/haiku typecheck
  - name: unit-tests
    command: bun run --cwd packages/haiku test
  - name: no-placeholders
    command: >-
      ! grep -nE '\bTBD\b|\bTODO\b' packages/haiku/src/http/upload-routes.ts
      packages/haiku/src/http/assessments-routes.ts
status: completed
bolt: 1
hat: planner
started_at: '2026-04-30T17:06:39Z'
hat_started_at: '2026-04-30T17:06:39Z'
iterations:
  - hat: planner
    started_at: '2026-04-30T17:06:39Z'
    completed_at: '2026-04-30T17:54:08Z'
    result: advance
completed_at: '2026-04-30T17:54:08Z'
---
# SPA upload + assessments HTTP endpoints

## Scope

Implement the three HTTP endpoints in `packages/haiku/src/http/` that the review SPA calls for stage-output replacements, knowledge uploads, and reading the drift assessment list. Endpoint shapes match DATA-CONTRACTS.md §5; behavior matches `features/explicit-spa-upload.feature` and the assessment-visibility scenarios.

Deliverables:

1. **`POST /api/intents/{intent-slug}/uploads/stage-output`** in `upload-routes.ts` per DATA-CONTRACTS.md §5.1:
   - Multipart form-data fields: `stage` (string), `target_path` (string, stage-relative; full path = `stages/{stage}/{target_path}`), `file` (binary), `mode` (`"replace"` | `"create"` | `"upsert"`), `attribute_to_user` (string).
   - Authentication: existing session cookie auth from the review-server flow (mirror `/api/feedback`).
   - Validate target path: must canonicalise to `stages/{stage}/artifacts/**` (alias `outputs/` → `artifacts/` per AC-ALIAS3); reject anything else with `bad_target_path` (400). Reject paths escaping the stage outputs dir.
   - Validate `stage` exists in studio config. Reject sealed/completed stages with `stage_not_writable` (403).
   - Enforce file-size cap (50 MB default, configurable). Larger uploads return `payload_too_large` (413) before any bytes hit disk.
   - Validate intent state: archived/missing → `intent_not_found` (404). Locked worktree → `intent_locked` (423).
   - **Atomic write:** stream the file to a tempfile, then rename into place. **Stamp action-log entry** with `author_class: "human-via-mcp"` (using `appendActionLogEntry` from unit-03). **Append audit-log entry** to `write-audit.jsonl` (using `appendWriteAudit`) with `human_author_id: attribute_to_user` and `user_instruction_excerpt: null` (SPA uploads have no chat instruction). **Do NOT update `baseline.json`** per AC-SU2 / ARCHITECTURE.md §7.3 — the next tick's drift gate observes the divergence.
   - Response: `{ ok, path, sha256, bytes, baseline_updated: false, tick_will_observe: true }`.
2. **`POST /api/intents/{intent-slug}/uploads/knowledge`** in `upload-routes.ts` per DATA-CONTRACTS.md §5.2:
   - Multipart fields: `file`, `target_filename` (basename only, no path segments — reject anything with `/`), `stage` (string|null — null means intent-scope `knowledge/`, otherwise `stages/{stage}/knowledge/`), `description` (string, optional, attached to the audit record), `attribute_to_user` (string).
   - Validate `target_filename` has no path segments. Reject `filename_collision` (409) when destination exists and create-mode is implicit. Other behavior identical to stage-output endpoint (auth, atomic write, action-log + audit-log stamping, no baseline update).
   - Response: same shape as stage-output endpoint.
3. **`GET /api/intents/{intent-slug}/assessments`** in `assessments-routes.ts` per DATA-CONTRACTS.md §5.3:
   - Query params: `limit` (int, default 50, max 200), `since` (RFC 3339), `stage` (string), `outcome` (string).
   - Reads `stages/*/drift-assessments/DA-*.json` files across all stages of the intent, applies filters, sorts by `created_at` descending.
   - Response: `{ ok, assessments: Assessment[], total, has_more }`.
   - Errors: `bad_param` (400), `intent_not_found` (404).
4. **`GET /api/intents/{intent-slug}/assessments/{assessment-id}`** per DATA-CONTRACTS.md §5.4:
   - Returns `{ ok, assessment }` for `DA-NN.json`. `assessment_not_found` (404) when the file is missing or the ID format is invalid.
5. **Routing registration:** wire the three endpoints into `default-routes.ts` (the existing routing tree). The review SPA frontend (unit-11/12/13) calls these endpoints — they must be present with the exact paths above.
6. **Hook bypass invariant (AC-SU2 / Scenario "SPA upload does not trigger the PreToolUse workflow-managed-file hook"):** the SPA endpoint writes directly to disk without going through the agent's tool pipeline, so the existing `guard-workflow-fields` PreToolUse hook does NOT fire. Verify this by adding a test that uploads a file under `stages/design/artifacts/` and asserts the hook script is not invoked.
7. **Path-safety integration:** reuse the existing `path-safety.ts` helpers in `packages/haiku/src/http/` for path resolution and traversal-attack defence.
8. **Atomic temp file cleanup on rejection (Scenario "Upload exceeds the configured size limit"):** if the upload is rejected (size cap, locked worktree, etc.), no temp files are left in the worktree. The streaming logic uses a guard to delete partial tempfiles before returning the error response.

Tests:

- `test/upload-routes.test.mjs`:
  - Designer replaces a stage output: file written, action-log stamped, audit-log appended, no baseline update (Scenario "Designer replaces a stage output file via the SPA upload UI").
  - PO uploads a knowledge file: same invariants (Scenario "Product Owner attaches a new knowledge file via the SPA").
  - Replace preserves filename; uploaded file is renamed to the original target name.
  - `mode: "create"` with a colliding filename returns `filename_collision` (409).
  - Upload exceeds size cap → 413 with `payload_too_large`; no temp files left.
  - Locked worktree → 423 `intent_locked`.
  - Archived intent → 404 `intent_not_found`.
  - Per-stage availability: stage with no `artifacts/` configured rejects with `stage_not_writable`.
  - Hook-bypass: PreToolUse hook script is not invoked during upload.
  - Path traversal attack (`../../../etc/passwd` as `target_path`) rejected with `bad_target_path`.
- `test/assessments-routes.test.mjs`:
  - Listing endpoint returns most-recent-first by `created_at`.
  - Filters by `stage` and `outcome` work.
  - Single-assessment GET returns the full record.
  - 404 for missing intent or missing `DA-*.json` file.

## Completion Criteria

- `packages/haiku/src/http/upload-routes.ts` and `assessments-routes.ts` export Fastify route registrations wired into `default-routes.ts`.
- All scenarios in `features/explicit-spa-upload.feature` and the assessment-list scenarios in `features/drift-assessment-visibility.feature` are covered by passing tests.
- Biome, `tsc --noEmit`, and `bun run --cwd packages/haiku test` pass.
- No placeholders.
