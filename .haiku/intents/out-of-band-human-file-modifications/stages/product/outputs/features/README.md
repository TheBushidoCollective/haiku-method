# outputs/features/ — supplementary contract-verification scenarios

These 8 .feature files are NOT canonical user behavior. They are scenario-level contract verifications consumed by the development stage's contract-test layer.

For canonical user-behavior features see `/features/` at the intent root (5 files bound by the development stage's step-definition layer).

## Routing table

| File | DATA-CONTRACTS.md Section(s) | Verifies |
|---|---|---|
| `assessment_schema.feature` | §2.3 Assessment | Assessment record schema, append-only invariant, per-outcome resulting_sha semantics |
| `pending_marker_schema.feature` | §2.2 PendingMarker | PendingMarker schema, resolved_sha lifecycle, terminal-only clearance trigger |
| `baseline_schema.feature` | §2.1 Baseline | Baseline record schema (path, sha, author_class) |
| `drift_finding_and_action.feature` | §3.1, §3.2 | DriftFinding shape, manual_change_assessment action payload |
| `internal_events.feature` | §6 | drift_detected, assessment_recorded, pending_marker_cleared event payloads |
| `mcp_tools.feature` | §4 | haiku_human_write, haiku_baseline_init, haiku_classify_drift, haiku_baseline_clear_marker contracts |
| `http_api.feature` | §5 | POST /uploads/stage-output, POST /uploads/knowledge, GET /assessments[/{id}] |
| `cross_surface_naming.feature` | §7 | Cross-surface naming audit (entity names match across disk/action/MCP/HTTP/events) |

## Routing for downstream consumers

- **Development stage step-definitions layer** binds against `/features/` (canonical 5).
- **Development stage contract-test layer** binds against `outputs/features/` (these 8).
