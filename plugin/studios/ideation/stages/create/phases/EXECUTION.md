# Create Stage — Execution

## Per-unit baton (`creator → editor → verifier`)

Every create unit walks the three hats in order. The baton is the unit's section content evolving from rough draft to coherent slice of the deliverable:

1. **`creator` (plan + do):** Anchors in the research brief, decides whether the unit is divergent / convergent / both, generates content broadly where the work calls for variation and narrows with named criteria where it calls for selection. Hands off when every section traces to a research takeaway or gap, every load-bearing claim cites a source, and open questions are explicit.
2. **`editor` (do):** Refines clarity, tightens structure, sharpens the argument without altering meaning, calibrates terminology across sibling units. Hands off when paragraphs pass the "cut without losing meaning" test, terminology is consistent with siblings, and any meaning-changing edit was flagged for the creator rather than silently applied.
3. **`verifier` (verify):** Validates the body for substance, traceability to upstream inputs, internal coherence, and decision-register accountability. Either advances or rejects to the responsible hat within the unit.

Hat order is `plan → do → verify` because the creator's substance is the plan, the editor's sharpening is the do that brings the section to publishable shape, and the verifier closes the chain.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — Stage review agents (`accuracy`, `quality`) and studio-level review agents fire in parallel. Each files feedback if its lens identifies a finding.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, creator, feedback-assessor]` dispatches against each open feedback. The classifier routes the FB to the right unit; `creator` is the implementer (per the `fix_hats must be implementer` convention); the assessor independently decides closure.
4. **Gate** — `ask`. Local human approval is the path of least surprise for a creative deliverable — the human reads the draft and decides whether it's worth running through the adversarial `review` stage. Project overlays may upgrade to `external` (docs-platform review) without modifying the plugin default.

## Reviewer guidance specific to this stage

- **Untraceable claims** are the highest-priority finding class. A draft claim that doesn't tie back to the research brief is either ungrounded (sources missed it) or evidence the research stage left a gap (route a feedback back to `research`).
- **Strengthened paraphrases** of research findings are second. The creator's narrative pressure tends to flatten "may" into "will" and single-vendor cases into "industry-wide" patterns; the lens catches it.
- **Collapsed divergent generation** is third. If the unit's success criteria called for option variation and the draft shows one option dressed up as a slate, the divergent value was lost.
- **Slate-stage convergent work** is fourth. If the unit asked for a recommendation and the draft hands the reader a list of options without naming criteria, the convergence step didn't happen.
