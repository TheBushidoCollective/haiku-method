# Strategy Stage — Execution

## Per-unit baton (`strategist → brand-reviewer`)

Every strategy unit walks two hats. The baton is the unit body — goals, messaging framework, channel mix, KPIs — accumulating in one document:

1. **`strategist` (plan + do):** Reads the upstream research, the intent's constraints, and any sibling strategy units. Drafts the full strategy artifact: goals with specific targets, messaging framework keyed to segments, channel mix with citations, KPIs that ladder to goals. Hands off when every strategic choice cites a research finding and constraints are stated rather than assumed.
2. **`brand-reviewer` (verify):** Reads the artifact and runs the four-lens check from `hats/brand-reviewer.md` — internal consistency, brand alignment, traceability to research, KPI rigor. Advances on pass; on fail, names the failing lens and the specific paragraph, then calls `haiku_unit_reject_hat` to route back to the strategist.

The stage's hat list is two-deep rather than the canonical plan-do-verify triplet because the strategist's plan IS the output artifact — splitting plan from do would produce two passes on the same document with no meaningful baton between them. The rally-race test (architecture §2.3) is met by the strategist → brand-reviewer handoff: the strategist produces a defensible framework, the brand-reviewer's verdict either advances it or names a specific failure for re-authoring.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `consistency` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `consistency` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → strategist → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `strategist` is the implementer (re-author too); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. The user approves the strategy locally before content production begins, because strategy errors compound expensively downstream.

## Reviewer guidance specific to this stage

- **Channel choice driven by convention rather than audience behavior** is the most common drift. Look at every channel category named in the mix and ask: does the rationale cite a specific research signal, or does it lean on "we always do this"?
- **Goals without measurable targets** are wishes; KPIs without goals are noise. The ladder must be complete in both directions.
- **Silent contradiction with brand orthodoxy** is more dangerous than overt contradiction. Deliberate brand shifts are valid; accidental ones produce campaigns that don't look like the brand to the audience.
- **Value propositions that lead with the product before the customer's pain** are the most reliable signal of a strategy written from the inside out rather than from the audience's point of view. Reorder before approving.
