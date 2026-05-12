---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the validation suite covers every data-quality dimension that matters — schema, integrity, value range, reconciliation, business rules, and SLAs — at the right severity, with actionable diagnostics.

## Check

The agent **MUST** verify, and file feedback for any violation:

- **Per-entity coverage** — Every entity in `DATA-MODEL.md` has at least one assertion per family: schema compliance, uniqueness / referential integrity, value-range, and business rule
- **Business-rule trace** — Every business rule centralized in the transformation stage has a corresponding business-rule test in the validation suite. Schema-only coverage passes while data is silently wrong
- **Reconciliation completeness** — Source-to-target row counts (and key totals where the domain has aggregate signals) are reconciled with a stated tolerance. Per-partition reconciliation exists where the source and target are partitioned by the same dimension
- **Freshness coverage** — Every target table that has a freshness SLA has a watermark-based check that fails when lag exceeds the SLA. Trusting the pipeline's run status is not freshness coverage
- **Severity mix** — Correctness-critical checks (PK uniqueness, schema, reconciliation-beyond-tolerance) are blocking; slow-moving signals (null-rate drift, cardinality drift) are warnings; trend-only signals are informational. "Everything blocks" or "everything warns" both indicate severity wasn't designed
- **Diagnostic-context completeness** — Every failing assertion emits the entity, column, predicate, a sample of failing values, and a pointer back to the upstream source / transformation step that produced them
- **Explicit gap disclosure** — The suite documents what it does NOT cover and why. Silent gaps become silent bugs

## Common failure modes to look for

- A validation suite that passes every schema check but tests no business rules
- Reconciliation as a single aggregate check with no per-partition signal
- A freshness "check" implemented as "the pipeline succeeded today", not as a watermark vs. SLA comparison
- A suite where every assertion is blocking, freezing the pipeline on noise
- A suite where every assertion is a warning, providing no real safety net
- An assertion that fails with "violation in target_<table>" and nothing else, leaving the on-call to re-derive the failure manually
- A suite with no "what's not covered" section, leaving downstream stages to guess at the gaps
- A nullable-column check whose threshold is "less than 50% nulls" — a tolerance loose enough that it can't fire is not a tolerance
