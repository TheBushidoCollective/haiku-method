---
name: runbook
location: (project docs tree — e.g., docs/runbooks/, ops/runbooks/, RUNBOOKS/)
scope: repo
format: markdown
required: true
---

# Runbooks and SLO bundle

The reliability artifact set the `sre` hat produces for each operations unit. Two things land together: per-pageable-alert runbooks for the oncall to follow at 3 AM, and a unit-body augmentation that captures the SLO / alert / dashboard inventory.

## Expected artifacts

- **One runbook per pageable alert** — written to the project's runbook tree
- **A unit-body augmentation** — appended to the `ops-engineer`'s body, capturing SLOs, alerts, runbooks, dashboards, and the "no PII in telemetry" attestation

## Quality signals

- Every SLO has a target, a window, and a named SLI
- Every SLO has an error budget computed
- Every pageable alert links to a runbook
- Every runbook has triage steps, mitigations ordered by reversibility, and an escalation path
- Dashboards exist for SLO compliance and the four golden signals (latency, traffic, errors, saturation)
- No PII / credentials / tokens / session IDs land in logs, metrics, or traces — confirmed inline

## Per-runbook shape

A runbook is a step-by-step guide a sleepy oncall can follow without thinking. Per pageable alert:

```
## Runbook: <alert name>

### What this alert means
<one paragraph in plain language — what symptom the SLI is detecting, what it implies about user impact>

### Symptoms to verify
<the dashboard / metric / log query to confirm the alert is real (not a metrics glitch)>

### Initial triage (5 minutes)
1. Check <dashboard> — confirm <metric> is elevated
2. Check <related dashboard> — is the cause upstream or local?
3. Check <recent-deploys log> — was anything deployed in the last <window>?

### Mitigations (in order of reversibility)
1. <least destructive — flag flip, rate limit increase, cache warm-up>
2. <intermediate — rollback last deploy if recent>
3. <last resort — failover, scale-up, page upstream>

### When to escalate
- If <condition> after <time>, page <next tier>
- If <condition>, page <subject-matter expert>

### Postmortem checklist
<links to the postmortem template + any data-collection that needs to happen DURING the incident before the data ages out>
```

## Unit-body augmentation shape

Appended to (do not overwrite) the `ops-engineer`'s body:

```
## SLOs

| SLI                              | SLO target | Window | Source metric | Error budget per window |
|----------------------------------|------------|--------|---------------|-------------------------|
| Availability of <surface>        | 99.5%      | 30d    | <metric name> | ~3.6h / 30d             |
| p95 latency of <endpoint>        | < 200ms    | 7d     | <metric name> | n/a (latency SLO)        |
| Error rate of <surface>          | < 1%       | 24h    | <metric name> | 14.4 min / 24h           |

## Alerts

| Alert name | Fires on | Severity | Pages whom | Runbook |
|------------|----------|----------|------------|---------|
| <name>     | <expression> | page / ticket | <rotation> | <link> |

## Runbooks

<one runbook per pageable alert — see Per-runbook shape above>

## Dashboards

<links to the project's dashboarding tool for: SLO compliance, golden signals, the critical user journey for this surface>

## Sensitive-data protection in telemetry

<confirmation that no PII / credentials / tokens leak into logs, metrics, traces; list any allow-list filtering applied>
```
