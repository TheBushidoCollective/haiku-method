---
title: Dashboards mandate is unmet — zero dashboard artifacts exist
status: rejected
origin: adversarial-review
author: observability
author_type: agent
created_at: '2026-05-02T05:31:28Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-02T05:31:28Z'
resolution: null
replies: []
---

**Mandate violation:** The observability mandate requires "dashboards exist for the critical user journeys." The deliverables ship alerts (`deploy/operations/drift-detection-alerts.yaml`) and SLOs (`deploy/operations/drift-detection-slos.yaml`) but *zero* dashboard artifacts.

**Evidence:**
- `find deploy -type f` shows only terraform, auth-proxy, and the two YAML files. No Grafana JSON, no Sentry dashboard config, no `dashboards/` directory.
- `grep -ln dashboard deploy/ .haiku/knowledge/RUNBOOK.md` returns nothing for the operations stage's deliverables.
- The runbook tells operators to "group by intent_slug in your OTLP backend" (`RUNBOOK.md:600-601`) and "plot trend over 7d" (`RUNBOOK.md:622-623`) but ships no canvas to plot against.

**Why this is a finding, not nitpicking:** The four golden signals are spread across 14+ event names. Without a dashboard, the runbook diagnostic steps ("compare `haiku.drift.surface.size` and `haiku.drift.markers.total_count` deltas across the window") require the on-call to compose ad-hoc PromQL at 3am. That's the failure mode the dashboards mandate exists to prevent.

**Suggested fix:** Add at least a per-intent overview dashboard (latency p95/p99, tick rate, error rate, surface size, markers open_count) plus a fleet-overview dashboard (aggregate across intents, top-N by surface size, top-N by error rate). Format-portable: Grafana JSON or Sentry dashboard YAML, committed under `deploy/operations/dashboards/`.

**File refs:**
- `deploy/operations/` (missing `dashboards/` subdir)
- `.haiku/knowledge/RUNBOOK.md:596-602` (runbook assumes a backend you can group in but ships no dashboard)
- `plugin/studios/software/stages/operations/review-agents/observability.md` (mandate)

---

**Rejection reason:** Out of operations-stage scope. The H·AI·K·U plugin runs as a per-user MCP server with no centralized dashboard infrastructure (no Grafana, no Datadog, no shared metrics backend) — the SPA's drift-assessments view is the only viewing surface this project ships, and it's per-finding, not aggregate. Authoring dashboards against telemetry no operator can collect would be specification theater. The mandate's "dashboards exist for critical user journeys" assumes a deployed service with shared observability infra; this assumption doesn't hold for a local plugin.
