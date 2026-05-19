# Budget Stage — Execution

## Per-unit baton (`budget-owner → allocator → verifier`)

Every budget unit walks the three hats in order. The baton is the unit's own outputs accumulating on disk:

1. **`budget-owner` (plan):** Reads the forecast model. Sizes the envelope (anchored to the forecast scenario named explicitly — base case unless justified otherwise). Picks the allocation methodology (zero-based / activity-based / driver-based / incremental) and justifies the fit. Sets priority rankings tied to strategic objectives from intent context. Defines contingency size and release conditions with a data-backed basis. Hands off when the framework is complete enough for the allocator to apply without re-deriving any choice.
2. **`allocator` (do):** Reads the framework. Maps each line item to a forecast driver and a strategic objective. Validates resource availability (headcount, contracts, capital, cross-dept dependencies). Documents per-line-item rationale. Reconciles total to envelope; surfaces over-envelope deferrals explicitly. Hands off when every allocation traces both upstream and downstream.
3. **`verifier` (verify):** Reads the unit body. Validates substance, traceability, coherence, and decision-register alignment.

The hat order is `plan → do → verify` because the budget-owner sets the rule the allocator implements; verifier checks against substance, not against the rule itself.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `alignment` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `alignment` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → budget-owner → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `budget-owner` is the implementer (re-derives the framework slice); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. Budget allocations typically require finance-leadership signoff outside this loop (budget committee, CFO, board). The engine waits for the external approval signal.

## Reviewer guidance specific to this stage

- **An allocation with no forecast linkage and no strategic linkage** is the single highest-priority finding — it's spending with no justification.
- **Equal-percentage trim across all lines** when the request set exceeds the envelope hides the real prioritization decision; surface deferrals explicitly.
- **Contingency stated as a flat percentage** (`"10% reserve"`) without a risk model is a tell that the underlying risk model is missing.
- **Headcount allocation whose hire ramp exceeds the org's recruiting capacity** is feasibility theater — surface it as a constraint rather than letting it slide as an aspiration.
