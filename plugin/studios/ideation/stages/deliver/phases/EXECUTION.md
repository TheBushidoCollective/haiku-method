# Deliver Stage — Execution

## Per-unit baton (`publisher → verifier`)

Each deliver unit walks two hats in order. The baton is the operational result accumulating in the unit body:

1. **`publisher` (do):** Reads the surviving review findings, addresses critical and major findings (fix, remove, or explicitly caveat), adjusts tone and depth for the named audience, finalizes formatting, packages for the delivery channel. Writes the preconditions / action performed / post-condition check / rollback into the unit body. Hands off when every surviving critical finding is addressed, no claim's meaning shifted during tone adjustment, and the operational record is complete.
2. **`verifier` (verify):** Validates the body for the four operational sections (preconditions, action, post-condition, rollback), checks that the post-condition produces a clear pass/fail signal, and confirms rollback is named (or "no rollback — forward-fix only" with rationale). Either advances or rejects within the unit.

This stage uses a two-hat baton because planning for delivery happens during decompose — the elaborator-stage planner decides which operational steps are needed; per-unit replanning rarely adds value. Project overlays may insert a third hat (e.g., a `formatter` between `publisher` and `verifier`) when a complex delivery channel justifies it.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `completeness` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `completeness` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → publisher → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `publisher` is the implementer (claims that need to change rather than be repackaged); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. The human-decision points already happened in `create`'s `ask` gate and `review`'s `ask` gate. Anything still open at delivery is operational and the engine can advance the stage on its own.

## Reviewer guidance specific to this stage

- **Surviving placeholders** are the highest-priority finding class. A `TODO`, `FIXME`, or `<bracketed placeholder>` that reaches `deliver` indicates the creator or editor handed off prematurely; the final form is not the work-of-record if any draft scar is visible.
- **Substantive rewrites done under the publisher hat** are second. If the publisher silently rewrote a claim's meaning instead of routing back to `create`, the audit trail of "what was reviewed vs. what shipped" is broken.
- **Vague post-conditions** are third. "Verify the deliverable looks right" doesn't produce a pass/fail signal; the verifier hat will reject for it.
- **Missing rollback on non-idempotent actions** is fourth. Operations that can't be cleanly re-run need a named recovery path; silent absence is how the next iteration paints itself into a corner.
