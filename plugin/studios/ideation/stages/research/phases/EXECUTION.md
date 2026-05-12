# Research Stage — Execution

## Per-unit baton (`researcher → analyst → verifier`)

Every research unit walks the three hats in order. The baton is the unit's body accumulating evidence and structure:

1. **`researcher` (plan + do):** Reads the unit's title and frame, casts a wide net across substantively different source classes, and writes sourced findings into the body. Hands off when every non-trivial claim names a specific source with a retrieval date and contradictions are surfaced rather than silently resolved.
2. **`analyst` (do):** Reads the researcher's findings and turns them into ranked patterns, reconciled contradictions, and actionable takeaways. Hands off when each pattern has a strength rating and a relevance note, and takeaways are written as guidance for downstream stages.
3. **`verifier` (verify):** Validates the body for substance, citation rigor, internal consistency, and decision-register accountability. Either advances (the body passes every body-only check) or rejects with a named criterion (rewinds to the responsible hat within the current unit).

Hat order is `plan → do → verify` because findings are the plan, analysis is the do, and validation is the verify. The researcher's sourced raw catch becomes the analyst's narrative-structured catch becomes the verifier's signed-off knowledge artifact.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the stage's artifacts conform to what the intent scoped.
2. **Quality review (parallel)** — The stage's review agents (`thoroughness`) and any studio-level review agents fire in parallel. Each files feedback if its lens identifies a finding.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, researcher, feedback-assessor]` dispatches against each open feedback. The classifier routes the FB to the right unit; `researcher` is the implementer; the assessor independently decides closure.
4. **Gate** — `auto`. Research correctness gets verified downstream by consumption: if a research gap is real, it surfaces in `create` or `review` and routes back via cross-stage feedback. Human approval at this gate would add ceremony without information.

## Reviewer guidance specific to this stage

- **Source diversity gaps** are the highest-priority finding class. A claim sourced to five articles all citing the same primary study is a single-source claim wearing a five-source disguise; the downstream stages will inherit the source's blind spots.
- **Silently-resolved contradictions** are next. The whole point of casting wide is to surface where the evidence disagrees; if the brief picks a side without justification, the chosen side may not survive scrutiny in `review`.
- **Unsourced "common knowledge" claims** are how unverified assumptions become load-bearing for the rest of the lifecycle.
- **Vague knowledge gaps** ("further research recommended") are uncloseable. Reject them; require the gap to name the specific source class or stakeholder that would close it.
