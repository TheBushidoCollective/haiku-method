# Adoption Stage — Execution

## Per-unit baton (`adoption-coach → usage-analyst → verifier`)

Every adoption unit walks the three hats in order. The baton across the rally race is the unit's `USAGE-REPORT.md` accumulating on disk:

1. **`adoption-coach` (plan):** Reads the upstream `ONBOARDING-REPORT.md` and any prior usage signals. Names the specific adoption play (feature, workflow, persona, segment), writes the outcome chain tied to a cited business outcome, sequences the enablement, and declares the four targets the analyst will measure (baseline, target, leading indicator, anti-metric).
2. **`usage-analyst` (do):** Reads the coach's declared targets. Instruments and measures each one with the same definition, window, and segment the coach declared. Produces the measurement table with baseline / current / target / gap, at least one segmentation cut that points at the bottleneck, and an interpretation paragraph that describes what the data shows without prescribing the next play.
3. **`verifier` (verify):** Reads the unit body and validates the operational shape (preconditions, action, post-condition, rollback). Either advances or rejects with the responsible hat named.

The hat order is `plan → do → verify` because the coach declares what to measure and the analyst measures it. Swapping the order would have the analyst inventing targets — which is how adoption metrics drift toward what's convenient instead of what matters.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `effectiveness` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `effectiveness` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → adoption-coach → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `adoption-coach` is the implementer (re-authoring the play or the targets); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Once the verifier has signed off and review is clean, the workflow advances to `health-check` without a human checkpoint.

## Reviewer guidance specific to this stage

- **Targets and measurements that don't match** is the single highest-priority finding. They are the same contract in two roles — if the coach declared one metric and the analyst measured another, downstream decisions get made against drifted numbers.
- **Anti-metric silently omitted** is the next-highest. A play that hits its target while its anti-metric blows up is not a green play.
- **Vanity metrics** (logins, page views) appearing in the measurement table when the coach declared workflow-completion metrics is style drift that compounds into renewal-time disputes.
