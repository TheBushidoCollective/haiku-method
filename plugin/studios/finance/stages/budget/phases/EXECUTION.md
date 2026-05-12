# Budget Stage — Execution

## Per-unit baton (`budget-owner → allocator → verifier`)

Every budget unit walks the three hats in order. The baton is the unit's own outputs accumulating on disk:

1. **`budget-owner` (plan):** Reads the forecast model. Sizes the envelope (anchored to the forecast scenario named explicitly — base case unless justified otherwise). Picks the allocation methodology (zero-based / activity-based / driver-based / incremental) and justifies the fit. Sets priority rankings tied to strategic objectives from intent context. Defines contingency size and release conditions with a data-backed basis. Hands off when the framework is complete enough for the allocator to apply without re-deriving any choice.
2. **`allocator` (do):** Reads the framework. Maps each line item to a forecast driver and a strategic objective. Validates resource availability (headcount, contracts, capital, cross-dept dependencies). Documents per-line-item rationale. Reconciles total to envelope; surfaces over-envelope deferrals explicitly. Hands off when every allocation traces both upstream and downstream.
3. **`verifier` (verify):** Reads the unit body. Validates substance, traceability, coherence, and decision-register alignment.

The hat order is `plan → do → verify` because the budget-owner sets the rule the allocator implements; verifier checks against substance, not against the rule itself.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `alignment` review agent and any studio-level review agents fire.
3. **Fix loop** — `fix_hats: [classifier, budget-owner, feedback-assessor]`. Classifier targets the affected allocation; `budget-owner` re-derives the framework slice; assessor decides closure.
4. **Gate** — `external` — budget allocations typically require finance-leadership signoff outside this loop (budget committee, CFO, board). The engine waits for the external approval signal.

## Reviewer guidance specific to this stage

- **An allocation with no forecast linkage and no strategic linkage** is the single highest-priority finding — it's spending with no justification.
- **Equal-percentage trim across all lines** when the request set exceeds the envelope hides the real prioritization decision; surface deferrals explicitly.
- **Contingency stated as a flat percentage** (`"10% reserve"`) without a risk model is a tell that the underlying risk model is missing.
- **Headcount allocation whose hire ramp exceeds the org's recruiting capacity** is feasibility theater — surface it as a constraint rather than letting it slide as an aspiration.
