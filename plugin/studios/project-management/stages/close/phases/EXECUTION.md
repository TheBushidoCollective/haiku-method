# Close Stage — Execution

## Per-unit baton (`closer → archivist → verifier`)

Every close unit walks the three hats in order. The baton across the rally race is the unit's own outputs accumulating in `RETROSPECTIVE.md` and `LESSONS-LEARNED.md`:

1. **`closer` (plan):** Reads the charter (deliverables and success criteria), the final status report (actual vs. planned), and the issue / risk / change-request registers. Maps every charter deliverable to acceptance evidence with named accepting stakeholder and date. Measures every success criterion using its documented method and records the result. Records ownership transfer for every ongoing surface with new-owner acceptance. Dispositions every open issue, risk, change request, and action item (resolved / transferred / deferred / accepted). Confirms every contractual or compliance obligation. Hands off when every deliverable has acceptance evidence, every criterion has a measured result, every transfer has acceptance, every open item has a disposition, and every obligation is confirmed.
2. **`archivist` (do):** Reads the closer's outputs. Runs the retrospective with specific moments (not anonymized aggregate observations). Captures lessons learned classified as process / technical / organizational, each with what-happened + what-we-learned + recommendation + conditions where it applies. Organizes documentation in permanent locations (not project-temp folders) with owning roles. Builds the archive index and writes the one-page project summary. Hands off when retrospective captures both what worked and what didn't with specifics, every lesson is categorized and conditioned, and the archive is indexed for future findability.
3. **`verifier` (verify):** Reads the unit's full body. Checks acceptance evidence, owner-and-date on open items, project-specific (not generic) lessons, accessible archive structure, and decision-register consistency per the verifier mandate. Either advances or rejects with the failing criterion named.

The hat order is `plan → do → verify` because formal acceptance, transfer, and disposition frame what gets reflected on in the retrospective. Running the retrospective before disposition is complete produces lessons decoupled from what actually shipped.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's `closure` review agent and any studio-level review agents fire in parallel.
3. **Fix loop (if any feedback opens)** — The `fix_hats: [classifier, closer, feedback-assessor]` chain dispatches per finding. Classifier routes; `closer` re-authors the affected acceptance, transfer, or disposition; the assessor independently decides closure.
4. **Gate** — The gate is `ask` — sponsor and team review of closeout artifacts before formal sign-off. Project overlays may add organization-specific formal-closure workflow integration.

## Reviewer guidance specific to this stage

- **Acceptance asserted without recorded evidence** is the highest-priority finding — without an artifact pointing to acceptance, the project is closed-by-agreement only and the next governance review will reopen it.
- **Silently dropped success criteria** are next. A criterion that disappears from the close conversation undermines every future charter's success criteria.
- **Open items left in "we'll come back to it" limbo** are corrosive — every undispositioned item is a future surprise. Force a disposition decision on each.
- **Generic lessons** (`"communicate better"`, `"plan more carefully"`) don't transfer. They have to be conditioned on specific situations to be useful to a future project.
