# Stakeholder Review Stage — Execution

## Per-unit baton (`presenter → feedback-synthesizer → verifier`)

Every stakeholder-review unit walks the three hats in order. The baton across the rally race is the unit body accumulating presentation framing, then session capture, then a durable alignment record:

1. **`presenter` (plan / package):** Identifies the audience and the ask (what specific decision, what "yes" looks like, what "no" looks like). Structures the presentation for decision rather than information density. Anticipates likely objections with named responses and backup material. Produces the presentation artifact plus a record of audience, ask, and anticipated objections in the unit body.
2. **`feedback-synthesizer` (do / capture):** Captures verbatim statements from the session with attribution and context. Classifies each item as strategy-changing, refining, or noted. Records decisions (with named decision-makers, owners, due dates, affected roadmap elements) and contested items (with escalation paths). Produces the alignment record.
3. **`verifier` (verify):** Validates the alignment record body-only — every decision has a named decision-maker, every refinement has an owner, every contested item has an escalation path with what blocks until then. Advances or rejects with a named criterion.

The hat order is `plan → do → verify` because the alignment record is only meaningful if the session was set up to drive a decision; the verifier checks the combined artifact.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `clarity` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `clarity` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → presenter → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `presenter` is the implementer (re-frames against the gap — usually because the deck didn't surface a risk or trade-off the stakeholder needed to see); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. Alignment is something an external decision-making body confirms (leadership review forum, steering committee, customer-advisory signoff). The engine blocks until that signal arrives.

## Reviewer guidance specific to this stage

- **A decisional ask framed as informational** is the highest-priority finding — the session burns without producing a commitment.
- **Anonymous decision entries** ("the team agreed") in the alignment record are findings to file; ambiguity here is how alignment quietly fails downstream.
- **Trade-offs absent from the deck** but present in the underlying prioritization unit signal a presentation designed to avoid friction rather than drive a real decision.
- **Contested items recorded as open with no escalation path** leave downstream work blocked indefinitely.
- **Truncated charts or unsourced visuals** are a serious finding — visual misrepresentation, intentional or not, destroys credibility once any stakeholder catches it.
