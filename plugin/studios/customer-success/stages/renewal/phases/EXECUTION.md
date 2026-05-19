# Renewal Stage — Execution

## Per-unit baton (`renewal-manager → executive-sponsor → verifier`)

Every renewal unit walks the three hats in order. The baton across the rally race is the unit's `RENEWAL-STRATEGY.md` accumulating on disk:

1. **`renewal-manager` (plan):** Reads the upstream `OPPORTUNITY-BRIEF.md`, the most recent `HEALTH-REPORT.md`, and the original sales context. Builds the value-realization narrative with cited customer-side data. Prepares responses for the four standard objection categories (price, competitive, scope, timing) plus account-specific ones. Sets concession boundaries (open offer, acceptable counter, walk-away, escalation owner) per lever. Sequences the renewal motion by dependency. Hands off to the executive sponsor with the audience, the forward beats, and the touch type.
2. **`executive-sponsor` (do):** Reads the manager's strategy and the customer's publicly stated priorities. Confirms the executive audience (primary, secondary, briefing-only), builds the three-beat forward narrative (partnership so far, shift ahead, commitment), tailors per-executive framing (headline / strategic frame / concern / proof point), names the touch type with rationale, and positions the touch inside the renewal motion rather than alongside it.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the operational strategy must be in place before the executive narrative is layered on top. Inverting it produces executive engagement that's untethered from the motion and becomes the problem instead of the lever.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `risk-assessment` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `risk-assessment` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → renewal-manager → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `renewal-manager` is the implementer (re-framing the narrative or re-sequencing the negotiation); the assessor independently decides closure.

6. **Gate** — The stage's gate is `[external, await]`. The strategy is submitted for external sign-off (commercial / legal approval inside the user's organization) and then waits for the customer-side renewal-event signal before the workflow finalizes.

## Reviewer guidance specific to this stage

- **A value claim the customer would dispute** is the single highest-priority finding. Once the customer rejects the narrative's foundation, every downstream concession is recalibrated.
- **Concession boundaries stated as ranges with no escalation owner** is the next-highest. Without a named owner the boundary is improvisation, and improvisation under pressure loses margin.
- **An executive narrative any senior CSM could deliver** is style drift that wastes the executive touch — the value of the touch is the commitment no one else can make.
