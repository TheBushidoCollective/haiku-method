# Certify Stage — Execution

## Per-unit baton (`certifier → reviewer`)

This stage uses a two-hat chain because the verify role is the independent reviewer. Each unit walks:

1. **`certifier` (plan + do):** Reads the strategy, the quality report, and the test results. Evaluates each exit criterion against its evidence (MET / PARTIAL / NOT-MET). Compiles the known-issues list with risk-acceptance status. Writes the determination (CERTIFY / CERTIFY-WITH-KNOWN-ISSUES / DEFER / BLOCK) with rationale and counts. Hands off when every criterion is assessed and every unresolved defect is in the known-issues list.
2. **`reviewer` (verify):** Audits the evidence chain backwards from determination to source. Spot-checks cited evidence. Validates risk-acceptance roles. Checks for systemic gaps the certifier may have buried (silently dropped dimensions, regression skipped, environment drift). Advances on a clean chain; rejects naming the broken link. Does not edit the certifier's section.

The two-hat structure consolidates plan + do into `certifier` because evidence evaluation IS the planning AND the doing — they don't separate cleanly. `reviewer` is the verify role for the stage.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → certifier → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `certifier` is the implementer (re-evaluates affected criteria); the assessor independently decides closure.

6. **Gate** — The stage's gate is `external`. Certification is the artifact a real authority signs — product owner, release manager, compliance lead, audit body. The workflow waits on the external signal; project overlays handle the sign-off ladder, audit-trail location, and any regulatory submission specifics.

## Reviewer guidance specific to this stage

- **Evidence chain breaks are the highest-priority finding.** A determination that doesn't follow from the assessment, or an assessment that doesn't follow from the evidence, breaks the audit trail.
- **Wrong-role risk acceptance** invalidates a known-issues entry — security findings accepted only by the product owner, for example.
- **Silent dimension drops** are the most-missed gap — a strategy that claimed accessibility in scope but a certification that has no accessibility evidence.
- **Threshold relaxation** is harder to catch but breaks the contract — flag any criterion where the threshold in the assessment doesn't match the strategy verbatim.
- **Determination rationale that summarizes without citing** is unaudit-able and gets rejected.
