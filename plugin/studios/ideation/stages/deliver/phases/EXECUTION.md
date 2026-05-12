# Deliver Stage — Execution

## Per-unit baton (`publisher → verifier`)

Each deliver unit walks two hats in order. The baton is the operational result accumulating in the unit body:

1. **`publisher` (do):** Reads the surviving review findings, addresses critical and major findings (fix, remove, or explicitly caveat), adjusts tone and depth for the named audience, finalizes formatting, packages for the delivery channel. Writes the preconditions / action performed / post-condition check / rollback into the unit body. Hands off when every surviving critical finding is addressed, no claim's meaning shifted during tone adjustment, and the operational record is complete.
2. **`verifier` (verify):** Validates the body for the four operational sections (preconditions, action, post-condition, rollback), checks that the post-condition produces a clear pass/fail signal, and confirms rollback is named (or "no rollback — forward-fix only" with rationale). Either advances or rejects within the unit.

This stage uses a two-hat baton because planning for delivery happens during decompose — the elaborator-stage planner decides which operational steps are needed; per-unit replanning rarely adds value. Project overlays may insert a third hat (e.g., a `formatter` between `publisher` and `verifier`) when a complex delivery channel justifies it.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — Stage review agents (`completeness`) and studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, publisher, feedback-assessor]` dispatches per finding. The classifier routes the FB; `publisher` is the implementer; the assessor independently decides closure. Substantive findings (claims that need to change rather than be repackaged) route back to `create` instead of being patched in `deliver`.
4. **Gate** — `auto`. The human-decision points already happened in `create`'s `ask` gate and `review`'s `ask` gate. Anything still open at delivery is operational and the engine can advance the stage on its own.

## Reviewer guidance specific to this stage

- **Surviving placeholders** are the highest-priority finding class. A `TODO`, `FIXME`, or `<bracketed placeholder>` that reaches `deliver` indicates the creator or editor handed off prematurely; the final form is not the work-of-record if any draft scar is visible.
- **Substantive rewrites done under the publisher hat** are second. If the publisher silently rewrote a claim's meaning instead of routing back to `create`, the audit trail of "what was reviewed vs. what shipped" is broken.
- **Vague post-conditions** are third. "Verify the deliverable looks right" doesn't produce a pass/fail signal; the verifier hat will reject for it.
- **Missing rollback on non-idempotent actions** is fourth. Operations that can't be cleanly re-run need a named recovery path; silent absence is how the next iteration paints itself into a corner.
