# Strategy Stage — Execution

## Per-unit baton (`strategist → brand-reviewer`)

Every strategy unit walks two hats. The baton is the unit body — goals, messaging framework, channel mix, KPIs — accumulating in one document:

1. **`strategist` (plan + do):** Reads the upstream research, the intent's constraints, and any sibling strategy units. Drafts the full strategy artifact: goals with specific targets, messaging framework keyed to segments, channel mix with citations, KPIs that ladder to goals. Hands off when every strategic choice cites a research finding and constraints are stated rather than assumed.
2. **`brand-reviewer` (verify):** Reads the artifact and runs the four-lens check from `hats/brand-reviewer.md` — internal consistency, brand alignment, traceability to research, KPI rigor. Advances on pass; on fail, names the failing lens and the specific paragraph, then calls `haiku_unit_reject_hat` to route back to the strategist.

The stage's hat list is two-deep rather than the canonical plan-do-verify triplet because the strategist's plan IS the output artifact — splitting plan from do would produce two passes on the same document with no meaningful baton between them. The rally-race test (architecture §2.3) is met by the strategist → brand-reviewer handoff: the strategist produces a defensible framework, the brand-reviewer's verdict either advances it or names a specific failure for re-authoring.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `consistency` review agent fires, plus any studio-level review agents.
3. **Fix loop** — `fix_hats: [classifier, strategist, feedback-assessor]` dispatches per finding. The brand-reviewer is intentionally not in the fix loop because the strategist owns the underlying choices; brand-reviewer is the verify path on re-author too.
4. **Gate** — `ask`. The user approves the strategy locally before content production begins, because strategy errors compound expensively downstream.

## Reviewer guidance specific to this stage

- **Channel choice driven by convention rather than audience behavior** is the most common drift. Look at every channel category named in the mix and ask: does the rationale cite a specific research signal, or does it lean on "we always do this"?
- **Goals without measurable targets** are wishes; KPIs without goals are noise. The ladder must be complete in both directions.
- **Silent contradiction with brand orthodoxy** is more dangerous than overt contradiction. Deliberate brand shifts are valid; accidental ones produce campaigns that don't look like the brand to the audience.
- **Value propositions that lead with the product before the customer's pain** are the most reliable signal of a strategy written from the inside out rather than from the audience's point of view. Reorder before approving.
