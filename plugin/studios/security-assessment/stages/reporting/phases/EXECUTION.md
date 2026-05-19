# Reporting Stage — Execution

## Per-unit baton (`report-writer → remediation-advisor → verifier`)

Each unit covers ONE finding (or one tightly-coupled cluster). The hats walk in order; the baton is the unit's accumulated body content:

1. **`report-writer` (plan/do):** drafts the finding section — title + severity, executive summary, affected asset, description, reproduction notes appropriate to the engagement's classification scheme, evidence references, severity derivation, and a placeholder for remediation. Three-audience calibration is the discipline.
2. **`remediation-advisor` (do):** fills the remediation block — immediate mitigation, full fix specific to the technology in use, strategic improvement, verification check at each layer, prioritization (risk-reduction value, effort, dependencies), and any risk introduced by the recommendation itself.
3. **`verifier` (verify):** body-only validation — preconditions, action, post-condition; evidence references resolve; severity rubric consistent across findings; reproduction-detail classification respected.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `remediation-quality` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `remediation-quality` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → report-writer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `report-writer` is the implementer (most findings here are clarity, evidence-completeness, or audience-calibration issues); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. The deliverable is the engagement product — sign-off lives in the customer's review channel (ticketing system, doc platform, signed PDF), not in a local approval.
