# Close Stage — Execution

## Per-unit baton (`closer → archivist → verifier`)

Every close unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating in `RETROSPECTIVE.md` and `LESSONS-LEARNED.md`:

1. **`closer` (plan):** Reads the charter (deliverables and success criteria), the final status report (actual vs. planned), and the issue / risk / change-request registers. Maps every charter deliverable to acceptance evidence with named accepting stakeholder and date. Measures every success criterion using its documented method and records the result. Records ownership transfer for every ongoing surface with new-owner acceptance. Dispositions every open issue, risk, change request, and action item (resolved / transferred / deferred / accepted). Confirms every contractual or compliance obligation. Hands off when every deliverable has acceptance evidence, every criterion has a measured result, every transfer has acceptance, every open item has a disposition, and every obligation is confirmed.
2. **`archivist` (do):** Reads the closer's outputs. Runs the retrospective with specific moments (not anonymized aggregate observations). Captures lessons learned classified as process / technical / organizational, each with what-happened + what-we-learned + recommendation + conditions where it applies. Organizes documentation in permanent locations (not project-temp folders) with owning roles. Builds the archive index and writes the one-page project summary. Hands off when retrospective captures both what worked and what didn't with specifics, every lesson is categorized and conditioned, and the archive is indexed for future findability.
3. **`verifier` (verify):** Reads the unit's full body. Checks acceptance evidence, owner-and-date on open items, project-specific (not generic) lessons, accessible archive structure, and decision-register consistency per the verifier mandate. Either advances or rejects with the failing criterion named.

The hat order is `plan → do → verify` because formal acceptance, transfer, and disposition frame what gets reflected on in the retrospective. Running the retrospective before disposition is complete produces lessons decoupled from what actually shipped.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `closure` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `closure` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → closer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `closer` is the implementer (re-authors the affected acceptance, transfer, or disposition); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Sponsor and team review of closeout artifacts before formal sign-off. Project overlays may add organization-specific formal-closure workflow integration.

## Reviewer guidance specific to this stage

- **Acceptance asserted without recorded evidence** is the highest-priority finding — without an artifact pointing to acceptance, the project is closed-by-agreement only and the next governance review will reopen it.
- **Silently dropped success criteria** are next. A criterion that disappears from the close conversation undermines every future charter's success criteria.
- **Open items left in "we'll come back to it" limbo** are corrosive — every undispositioned item is a future surprise. Force a disposition decision on each.
- **Generic lessons** (`"communicate better"`, `"plan more carefully"`) don't transfer. They have to be conditioned on specific situations to be useful to a future project.
