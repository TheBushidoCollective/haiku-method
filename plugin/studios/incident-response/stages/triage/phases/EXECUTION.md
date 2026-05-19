# Triage Stage — Execution

## Per-unit baton (`incident-commander → first-responder → verifier`)

Every triage unit walks the three hats in order. The baton across the rally race is the unit's slice of `INCIDENT-BRIEF.md` accumulating on disk:

1. **`incident-commander` (plan):** Reads the raw signal (alert payload, customer report, observed dashboard symptom). Writes the declaration block — severity tier with measured impact justification, named IC / scribe / comms lead, initial blast-radius hypothesis, comms cadence. Hands off when the declaration is complete and roles are assigned.
2. **`first-responder` (do):** Reads the declaration. Confirms the signal with an independent second source, snapshots ephemeral diagnostic data into the brief before it ages out of the observability platform, measures user-facing impact in concrete numbers, and translates technical symptoms into user-facing language. Hands off when the brief has confirmed signal, snapshots, impact number, and user-facing symptom.
3. **`verifier` (verify):** Reads the full brief. Checks that severity matches measured impact, blast radius covers one hop of dependencies, escalation path matches the tier, and roles are named. Either advances (`haiku_unit_advance_hat`) or rejects with the responsible hat named (rewinds to that hat within the current unit).

The hat order is `plan → do → verify` because the IC sets the frame the first responder fills in: the IC names what severity, scope, and ownership look like, the first responder produces the evidence, and the verifier checks that the evidence supports the IC's frame.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `severity-accuracy` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `severity-accuracy` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → incident-commander → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `incident-commander` is the implementer (re-owns the corrected decision because severity / ownership / scope are IC-scope choices); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Because triage is time-critical. As soon as the workflow engine confirms reviews are signed off and fix loops are closed, the stage advances so investigation can start without waiting on a human approval round.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Severity-impact mismatch** is the highest-priority finding. A SEV-1 with sub-1% impact (over-classification) wastes the response; a SEV-3 with significant revenue or regulatory exposure (under-classification) misses escalation steps that compound through the downstream stages.
- **Missing confirmation source** is next — a brief that trusts the original alert without independent ground-truth verification is a brief that may be acting on a false positive.
- **Blast-radius gaps** (failing component listed but downstream consumers omitted) propagate forward: the investigate stage and mitigate stage will work from the listed surfaces and miss the surfaces the brief didn't name.
- **Unassigned roles** (TBD or "the team" as IC / scribe / comms) defeat the coordination purpose of the stage.
