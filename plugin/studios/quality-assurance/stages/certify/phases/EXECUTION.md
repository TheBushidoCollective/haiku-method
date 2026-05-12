# Certify Stage — Execution

## Per-unit baton (`certifier → reviewer`)

This stage uses a two-hat chain because the verify role is the independent reviewer. Each unit walks:

1. **`certifier` (plan + do):** Reads the strategy, the quality report, and the test results. Evaluates each exit criterion against its evidence (MET / PARTIAL / NOT-MET). Compiles the known-issues list with risk-acceptance status. Writes the determination (CERTIFY / CERTIFY-WITH-KNOWN-ISSUES / DEFER / BLOCK) with rationale and counts. Hands off when every criterion is assessed and every unresolved defect is in the known-issues list.
2. **`reviewer` (verify):** Audits the evidence chain backwards from determination to source. Spot-checks cited evidence. Validates risk-acceptance roles. Checks for systemic gaps the certifier may have buried (silently dropped dimensions, regression skipped, environment drift). Advances on a clean chain; rejects naming the broken link. Does not edit the certifier's section.

The two-hat structure consolidates plan + do into `certifier` because evidence evaluation IS the planning AND the doing — they don't separate cleanly. `reviewer` is the verify role for the stage.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — `standards` review agent fires; surfaces exit-criterion gaps, evidence vagueness, risk-acceptance traceability issues, determination inconsistency, dimension drops, threshold relaxation, and audit-reference gaps.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, certifier, feedback-assessor]` dispatches per FB. The classifier routes; `certifier` re-evaluates affected criteria, sharpens rationale, or escalates a structural gap; the assessor decides closure.
4. **Gate** — `external`. Certification is the artifact a real authority signs — product owner, release manager, compliance lead, audit body. The workflow waits on the external signal; project overlays handle the sign-off ladder, audit-trail location, and any regulatory submission specifics.

## Reviewer guidance specific to this stage

- **Evidence chain breaks are the highest-priority finding.** A determination that doesn't follow from the assessment, or an assessment that doesn't follow from the evidence, breaks the audit trail.
- **Wrong-role risk acceptance** invalidates a known-issues entry — security findings accepted only by the product owner, for example.
- **Silent dimension drops** are the most-missed gap — a strategy that claimed accessibility in scope but a certification that has no accessibility evidence.
- **Threshold relaxation** is harder to catch but breaks the contract — flag any criterion where the threshold in the assessment doesn't match the strategy verbatim.
- **Determination rationale that summarizes without citing** is unaudit-able and gets rejected.
