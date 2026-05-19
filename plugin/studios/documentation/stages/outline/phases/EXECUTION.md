# Outline Stage — Execution

## Per-unit baton (`architect → outline-reviewer`)

Every outline unit walks the two hats in order. The baton is the unit's body as the IA accumulates:

1. **`architect` (plan / do):** Reads the audit's ranked gap list, decides Diátaxis mode per piece, groups and sequences by reader journey, drafts the hierarchy with per-section purpose statements, plans navigation and cross-references, and maps coverage back to the audit. Hands off when every piece has a mode, every section has a purpose statement, navigation paths are named, and every prioritized gap is addressed (or explicitly deferred).
2. **`outline-reviewer` (verify):** Walks realistic user journeys through the IA, checks structural rules (depth, sizing, mode integrity, cross-reference resolution), confirms audit coverage, and either advances or rejects with the responsible failure named. Does not redesign the outline.

The hat order is `plan → do/verify` because the architect's design IS the deliverable; the outline-reviewer's role is verification, not parallel authoring.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `structure` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `structure` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → architect → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `architect` is the implementer (re-authors the work); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Outline benefits from a human pass before drafting because structural changes after prose lands are expensive — moving a section after the prose is written usually means rewriting the prose.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Code-structure-based grouping** is the highest-priority finding for any audience that isn't an internal contributor. Readers don't search by module.
- **Mixed Diátaxis modes inside one piece** propagate into the draft and produce documents that fail every reader mode at once.
- **Missing entry points per audience** is a coverage gap that becomes invisible once drafting starts; once content exists, the absence of an entry point reads as "the docs don't help me" rather than "the IA is broken."
- **Silent gap omission** between the audit's ranked list and the outline's coverage map causes drift downstream: drafting addresses what's in the outline, so anything missing here is missing forever unless caught now.
