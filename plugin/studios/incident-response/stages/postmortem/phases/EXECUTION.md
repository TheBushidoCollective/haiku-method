# Postmortem Stage — Execution

## Per-unit baton (`postmortem-author → action-item-tracker → verifier`)

Every postmortem unit walks the three hats in order. The baton across the rally race is the unit's slice of `POSTMORTEM-DOCUMENT.md` accumulating on disk:

1. **`postmortem-author` (plan + do):** Reads every upstream artifact — the incident brief, the root-cause analysis, the mitigation log, the resolution summary. Writes the narrative for this section: the timeline with cited timestamps and sources, the detection story (how the incident was found and the latency to detection), the response story (coordination / response / mitigation / comms latency), the root cause translated for a wider audience, contributing factors with mechanisms, and the prevention measures that the action-item hat will operationalize. Maintains blameless framing throughout. Hands off when the narrative is complete and the systemic gaps are named.
2. **`action-item-tracker` (do — owner extraction):** Reads the narrative. Walks the named gaps (detection, response, root cause, tooling, process) and converts each into one or more concrete action items with named owners, priorities, and tracking references in the team's existing work-management system. Appends the action-item table. Hands off when every gap has at least one owned, tracked action item.
3. **`verifier` (verify):** Reads the section. Checks blameless framing, timeline completeness, action-item specificity / ownership / tracking, prevention measures targeting systemic class rather than just the instance, detection-and-response latency stated where measurable, and priorities distinguishing urgency. Advances or rejects to the responsible hat.

The hat order is `plan → do → verify` because the author produces the narrative that the action-item hat operationalizes: the narrative is the plan in the sense of identifying what should change; the action items are the do step that converts intent into commitment; the verifier checks both held to the stage's quality bar.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `actionability` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `actionability` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → postmortem-author → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `postmortem-author` is the implementer (re-owns corrections because narrative shape and framing are author-scope); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. Because the postmortem is a public artifact that goes through formal review (engineering review, leadership review, and depending on the incident class sometimes customer or regulator review). The workflow blocks until the external review system signals approval, typically via a merge or sign-off action in the team's docs platform.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Blame framing leaking through the prose** is a high-priority finding. The postmortem exists to produce learning, and a document that reads as accountability creates fear in future incidents — responders will hide observations rather than surface them.
- **Vague action items** are next — "improve monitoring" or "better runbooks" do not produce work; they produce wishes. Each item must be specific enough that a person could execute it without coming back to ask what was meant.
- **Unowned or untracked action items** lose all their value at the moment the postmortem document is closed — if the item only lives in the document, it doesn't live anywhere.
- **Prevention targets the instance rather than the class** is a quiet but important finding — patching the specific surface that hit this incident without addressing the underlying defect class leaves every other instance in place.
- **Missing detection or response latency in the timeline** removes the inputs to most monitoring and runbook action items; the document will then read as a story rather than a measurement.
- **Postmortem-document-only action items** are a finding on principle — items that aren't filed in the team's actual work system are forgotten the moment attention moves on.
