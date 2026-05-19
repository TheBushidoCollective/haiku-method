# Investigate Stage — Execution

## Per-unit baton (`investigator → log-analyst → verifier`)

Every investigate unit walks the three hats in order. The baton across the rally race is the unit's slice of `ROOT-CAUSE.md` accumulating on disk:

1. **`investigator` (plan):** Reads the triage stage's `INCIDENT-BRIEF.md` and any prior investigation units' findings. Frames a hypothesis as a falsifiable claim with named evidence sources, lists at least one competing hypothesis to test against, and writes the predicted observations that would confirm or refute the primary claim. Hands off when the hypothesis is concrete enough that a log query against named sources would produce a verdict.
2. **`log-analyst` (do):** Reads the hypothesis. Pulls logs / metrics / traces from the named sources with explicit time windows and filters, correlates across at least two independent sources, quotes specific entries with timestamps for citation, and synthesizes the evidence into a verdict (confirmed / refuted / inconclusive). Hands off with cited evidence and synthesis written into the unit.
3. **`verifier` (verify):** Reads the unit body. Checks that root cause is distinguished from proximate trigger, the causal chain is supported by cited evidence at every link, alternatives were tested and ruled out with named evidence, the timeline has no unexplained gaps, and detection latency is stated. Either advances or rejects to the responsible hat.

The hat order is `plan → do → verify` because the investigator frames the test the log-analyst executes: the investigator's job is to ask the right falsifiable question; the log-analyst's job is to answer it with cited evidence; the verifier's job is to confirm the answer holds up.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `thoroughness` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `thoroughness` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → investigator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `investigator` is the implementer (re-owns the corrected finding because hypothesis framing and evidence interpretation are investigator-scope); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Because investigation findings flow forward continuously. Humans review the consolidated narrative at the postmortem stage; the investigate stage's job is to feed correct diagnoses forward without blocking on a sync review round.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Root cause vs. proximate trigger** is the highest-priority finding. A finding that names "the deploy" as the root cause without naming the underlying defect in the deploy is naming the trigger, not the cause — the resolve stage downstream will then build a fix that closes the trigger surface while leaving the systemic condition exposed.
- **Unsupported causal links** are next. A causal chain where one link has no cited evidence breaks the whole chain; the postmortem will repeat the unsupported claim and the action items will target the wrong gap.
- **Single-hypothesis investigations** are findings on principle — an investigation that confirmed its only hypothesis and tested no alternatives may have stopped at the first plausible explanation rather than the right one.
- **Detection-latency gaps in the timeline** are quiet findings that compound at the postmortem stage; the action items targeting monitoring gaps need this number to exist.
