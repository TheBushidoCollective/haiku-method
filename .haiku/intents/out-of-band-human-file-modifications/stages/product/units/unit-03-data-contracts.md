---
title: Data contracts
model: sonnet
depends_on:
  - unit-01-acceptance-criteria
inputs:
  - intent.md
  - knowledge/DESIGN-DECISIONS.md
  - knowledge/DATA-CONTRACTS.md
  - stages/design/artifacts/ARCHITECTURE.md
  - stages/design/artifacts/MCP-TOOL-CONTRACT.md
  - stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md
  - stages/design/artifacts/SPA-UI-SPECS.md
  - stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md
outputs:
  - >-
    .haiku/intents/out-of-band-human-file-modifications/product/DATA-CONTRACTS.md
status: completed
bolt: 1
hat: validator
started_at: '2026-04-29T03:12:16Z'
hat_started_at: '2026-04-29T03:22:32Z'
iterations:
  - hat: product
    started_at: '2026-04-29T03:12:16Z'
    completed_at: '2026-04-29T03:17:46Z'
    result: advance
  - hat: specification
    started_at: '2026-04-29T03:17:46Z'
    completed_at: '2026-04-29T03:22:32Z'
    result: advance
  - hat: validator
    started_at: '2026-04-29T03:22:32Z'
    completed_at: '2026-04-29T03:23:07Z'
    result: advance
completed_at: '2026-04-29T03:23:07Z'
---
# Data contracts

Promote the data-contracts discovery artifact (`.haiku/intents/out-of-band-human-file-modifications/knowledge/DATA-CONTRACTS.md`) into the canonical product-stage location at `product/DATA-CONTRACTS.md` and reconcile its enums, naming, and lifecycle terms with the design-stage artifacts. The product-stage file is authoritative — when this unit completes, downstream stages (development, operations, security) read from `product/DATA-CONTRACTS.md`, not the knowledge-folder draft.

## Scope

`product/DATA-CONTRACTS.md` must cover, with explicit field tables (name, type, required/optional, default, constraints) and worked JSON examples:

- **Naming conventions** — pinned canonical entity names: `baseline`, `tracked_file`, `drift_finding`, `assessment`, `classification`, `pending_marker` — used identically across persistence, action payloads, MCP, HTTP, and events
- **Persistent state schemas** — `Baseline` (per-stage map of tracked_file_path → SHA + author_class + last_updated_tick), `PendingMarker` (open assessment-pending records for non-terminal classifications), `Assessment` (closed classification records with outcome, agent rationale, baseline-update timestamp)
- **Workflow-action payloads** — `DriftFinding` shape emitted by the pre-tick gate, the `manual_change_assessment` action input/output JSON, `Classification` shape per finding, legality matrix per change_kind, pre-tick gate ordering vs feedback-triage gate
- **MCP tool contracts** — `haiku_human_write_file`, `haiku_baseline_init`, `haiku_classify_drift`, `haiku_baseline_clear_marker` (matching the design-stage MCP-TOOL-CONTRACT.md names exactly) with request/response/error tables and atomic side-effect ordering
- **HTTP API surface** — `POST /uploads/stage-output`, `POST /uploads/knowledge`, `GET /assessments`, `GET /assessments/{id}` with multipart shapes and full HTTP error tables
- **Internal events** — `drift_detected`, `assessment_recorded`, `pending_marker_cleared` with payload, producer, consumers
- **Cross-surface naming audit** — explicit table proving every entity has the same name across disk, action payload, MCP, HTTP, and events; document any intentional variance with the conversion rule

## Reconciliation requirements (must be enforced before this unit can complete)

These are the gating substance gaps the pre-execute review found. None are optional.

1. **Canonical change_kind enum** — pin the values exactly to `added` | `modified` | `deleted` (lowercase, no aliases). Every reference across all schemas, action payloads, MCP, HTTP, and events MUST use these three values verbatim. If the discovery draft uses `created` / `updated` / `removed` / `replace`, rewrite it. The enum is also referenced from ARCHITECTURE.md and the .feature files; if any of those use a different value, that's a reconciliation failure that this unit has the authority (and obligation) to fix here.
2. **Canonical author_class enum** — pin the values exactly to `agent` | `human-via-mcp` | `human-implicit` (lowercase, hyphenated). The `Baseline` schema MUST include `author_class` as a required enum-typed field. No `user` / `external` / `manual` aliases.
3. **Canonical outcome enum** — pin the values exactly to `ignore` | `inline-fix` | `surface-as-feedback` | `trigger-revisit` (lowercase, hyphenated). The `Classification` and `Assessment` schemas use this enum. The `manual_change_assessment` action's `outcome` field references it. No `auto-fix` / `escalate` aliases.
4. **Outputs vs artifacts alias** — `tracked_file` MUST document explicitly that the tracked surface includes both `stages/<stage>/outputs/**` and `stages/<stage>/artifacts/**` paths under the same baseline (per the design-stage TRACKED-SURFACE-BOUNDARY.md decision that they are aliases). Add a short normative paragraph stating the canonical term used in code is whichever the architecture pinned, and the other is a deprecated alias kept for backward compatibility.
5. **`haiku_baseline_clear_marker` scope** — document explicitly that this MCP tool clears the `PendingMarker` for a single tracked file path. Document the trigger contract: it fires when a feedback transitions to `addressed` (mid-state, not just `closed`), so a pending-marker is cleared as soon as the human fix lands, not when the human formally closes the feedback. This is the AC-G entry that resolves the SPA-UI-SPECS vs ARCHITECTURE inconsistency.
6. **Surface-as-feedback baseline-update contract** — document explicitly that when an `Assessment.outcome === "surface-as-feedback"`, the `Baseline` row for the tracked file is updated to the post-drift SHA at the same time the assessment is recorded (atomic write). This prevents the next tick from re-detecting the same drift. This contract is referenced by AC-G7 in unit-01.
7. **Pending-revisit transition state** — document explicitly that the SPA's `pending-revisit` UI state corresponds to an `Assessment` whose `outcome === "trigger-revisit"` but whose `revisit_invoked_at` is null. The DATA-CONTRACTS.md must define the `Assessment.revisit_invoked_at: timestamp | null` field. The state transitions to `revisit-invoked` once the next tick calls `haiku_revisit`.
8. **Trust + Audit fields (DEC-9)** — the `Assessment` schema MUST include the audit fields: `initiated_by` (agent identity string), `triggering_request` (verbatim chat snippet or session id), `target_path`, `resulting_sha`, `recorded_at`. These are the audit fields unit-01 requires for AC-G's DEC-9 closure.

A field that's mentioned in passing does NOT satisfy these requirements — it must appear in the schema's field table with a type and a required/optional column AND be referenced by the cross-surface naming audit.

## Completion Criteria

- `product/DATA-CONTRACTS.md` exists and is at least 6KB of substantive prose with worked JSON examples
- Every persistence schema (`Baseline`, `PendingMarker`, `Assessment`) has a field table with name / type / required / default / constraints columns
- Every MCP tool contract has request / response / error tables and at least one worked JSON example
- Every HTTP endpoint has request shape (including multipart parts), response shape, and an error-code table covering at least 4xx classes (400/401/403/404/409/413) and the 5xx catch-all
- Every internal event has payload / producer / consumers documented
- Cross-surface naming audit table proves entity names match across all 5 surfaces (disk, action, MCP, HTTP, events)
- All 8 reconciliation requirements above are enforced — each enum is pinned in a single normative table referenced from every schema that uses it
- Document is internally consistent with `ARCHITECTURE.md`'s baseline-update contract and `MCP-TOOL-CONTRACT.md`'s tool semantics — no schema field contradicts a design decision
- Document does NOT contain TypeScript file paths under `packages/` or shell commands — those belong in development-stage units
- Boundary callouts to development stage are explicit: tracked-surface boundary substance, storage location, tick ID format, diff cap, SPA host process — referenced, not authored here
