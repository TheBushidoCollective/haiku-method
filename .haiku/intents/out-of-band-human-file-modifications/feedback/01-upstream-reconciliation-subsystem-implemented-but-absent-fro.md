---
title: >-
  Upstream-reconciliation subsystem implemented but absent from
  inception/product/design specs
status: addressed
origin: studio-review
author: cross-stage-consistency
author_type: agent
created_at: '2026-05-03T21:53:39Z'
iteration: 0
visit: 0
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-03T21:53:39Z'
resolution: null
replies: []
hat: reconciler
iterations:
  - bolt: 1
    hat: reconciler
    completed_at: '2026-05-03T22:03:39Z'
    result: advanced
---
## Finding

A substantial pre-tick reconciliation subsystem was built and operationalized as part of this intent, but it does not appear anywhere in the upstream specifications. The cross-stage trace is broken.

## Where it is implemented

- `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts` — full module, ~hundreds of lines, with finding shapes (`tool_name | http_status | field_name`), corpus walking, fingerprinting.
- `packages/haiku/src/orchestrator/workflow/run-tick.ts` — wires the gate into the pre-tick chain and emits a new action `upstream_reconciliation_required`.
- A new MCP tool `haiku_reconciliation_acknowledge` (referenced in operations docs).
- Telemetry metrics `haiku.reconciliation.fingerprint.{matched,drifted,established,duration_ms,write_failed}` and `haiku.reconciliation.corpus.bytes` (`packages/haiku/src/telemetry.ts`).
- Alert rules in `deploy/operations/drift-detection-alerts.yaml`.
- Tests in `packages/haiku/test/upstream-reconciliation.test.mjs`.
- Operations runbook scenarios "Reconciliation fingerprint mismatch" and "Reconciliation gate fires on stage with stale fingerprint" (`unit-01-operational-runbook.md`).

## Where it is missing

A `grep -rn "upstream-reconciliation\|haiku_reconciliation_acknowledge\|reconciliation gate\|upstream_reconciliation_required\|reconciliation fingerprint"` across the inception, product, design, and development stages returns zero hits.

- Inception (`knowledge/DISCOVERY.md`, `knowledge/DESIGN-DECISIONS.md`, `knowledge/IMPLEMENTATION-MAP.md`): no mention.
- Product (`product/ACCEPTANCE-CRITERIA.md`, `DATA-CONTRACTS.md`, `features/`): no mention. The five .feature files cover drift detection, SPA upload, classify, human-write, drift-assessment visibility — none cover reconciliation.
- Design (`stages/design/artifacts/ARCHITECTURE.md`, `MCP-TOOL-CONTRACT.md`, `TRACKED-SURFACE-BOUNDARY.md`, `ROLLOUT-AND-BASELINE-ESTABLISHMENT.md`, `SPA-UI-SPECS.md`): no mention. Design's gate-chain ordering is `tamper-detection → feedback-triage → drift-detection → per-state dispatch` — reconciliation is not a fourth gate. The action enumeration does not include `upstream_reconciliation_required`. The MCP tool list does not include `haiku_reconciliation_acknowledge`.
- Development (`stages/development/units/`, `knowledge/ARCHITECTURE.md`): no mention. The repo-level ARCHITECTURE.md's action surface in §2.3 lists `manual_change_assessment` as the only NEW action and the MCP tool list omits the reconciliation tool.

## Why this is a cross-stage consistency violation

The studio's lifecycle promise is that what ships is what was specified. A net-new pre-tick gate, with its own MCP tool, telemetry, alerts, and runbook, that was never proposed in inception, never appeared in product acceptance criteria, never showed up in design contracts, and never had a development unit, breaks every cross-stage trace the verifier hats relied on. The intent description in `intent.md` is specifically about *human file modifications* — out-of-band writes by humans — not about cross-document contradictions between agent-authored upstream artifacts. The reconciliation feature has its own scope (cross-document divergence detection) that is orthogonal to the human-write detection feature this intent was framed to deliver.

This is the classic "concerns raised in inception/product were actually addressed in implementation" check inverted: features were *added* in implementation/operations that were never raised in inception/product. The same checking applies symmetrically — drift between upstream specs and the implementation is a finding regardless of direction.

## Suggested resolution

Either (a) backfill specs across inception/product/design/development so the upstream-reconciliation feature has the same lifecycle trace every other piece of this intent has, OR (b) extract upstream-reconciliation into a separate intent (which is the right home for it given its scope is independent of human file modifications) and document its provenance there.

## File:line refs

- Implemented: `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts:1-80+`
- Pre-tick wiring: `packages/haiku/src/orchestrator/workflow/run-tick.ts` (search for `upstream_reconciliation_required`)
- Operations references: `.haiku/intents/out-of-band-human-file-modifications/stages/operations/units/unit-01-operational-runbook.md` (scenario 5 "Reconciliation fingerprint mismatch", scenario 11 "Reconciliation gate fires on stage with stale fingerprint")
- Operations references: `.haiku/intents/out-of-band-human-file-modifications/stages/operations/units/unit-02-telemetry-coverage.md` ("`haiku.reconciliation.fingerprint.duration_ms`", etc.)
- Missing in: `.haiku/intents/out-of-band-human-file-modifications/knowledge/DISCOVERY.md`, `DESIGN-DECISIONS.md`, `IMPLEMENTATION-MAP.md`, `DATA-CONTRACTS.md`, `ARCHITECTURE.md`
- Missing in: `.haiku/intents/out-of-band-human-file-modifications/stages/design/artifacts/ARCHITECTURE.md` §3.1 (gate-chain ordering), §4.1 (action enumeration)
- Missing in: `.haiku/intents/out-of-band-human-file-modifications/features/` (no `upstream-reconciliation.feature`)
