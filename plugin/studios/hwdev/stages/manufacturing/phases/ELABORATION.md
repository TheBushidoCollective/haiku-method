# Manufacturing Stage — Elaboration

Manufacturing is an **operational** stage. Its units are discrete operational steps in the design-for-manufacturability, assembly-process, QA-sampling, and production-ramp pipeline. Each unit specifies preconditions, action, post-condition check, and rollback.

## What a unit IS in this stage

One operational step in the production pipeline. Examples:

- "DFM review checklist run — feedback ingested into design or signed off"
- "Assembly process spec — line layout, station-by-station operations, takt time"
- "First-article inspection plan — sample size, instruments, accept/reject criteria"
- "QA sampling plan — AQL level, defect classification, re-test policy"
- "Production ramp gate — pilot run sample size, yield threshold, escalation path"
- "ESD / clean-room compliance pass — measurement record, certification scan"

What a unit is **NOT** in this stage:

- ❌ A design change (those belong back in `design` — file a feedback if the design is unmanufacturable)
- ❌ A field-failure RMA process (that's a post-launch concern, not initial manufacturing)
- ❌ A regulatory cert step (those belong in `validation`)

## What "completion criteria" means here

Operational-step criteria specify **preconditions, action, post-condition check, and rollback** — and must produce evidence that survives a quality audit.

### Good criteria — concrete and audit-ready

- "First-article inspection: 5 units pulled from the first production run, dimensional checks logged in `manufacturing/fai/run-001.csv`, all measurements within drawing tolerance"
- "Assembly station 3 (paste / placement) post-condition: solder paste inspection (SPI) reports >98% pad coverage on a 30-board sample, recorded with timestamps"
- "Pilot run gate: yield ≥ 95% on a 100-unit pilot before authorizing full production; failures categorized and recorded"

### Bad criteria — vague or wrong-stage

- ❌ "Manufacturing is ready" (tautological)
- ❌ "Boards build OK" (no instruments, no threshold, no record)
- ❌ "Design is good" — wrong stage; that's a `design` feedback if surfaced here

## How verification happens

Manufacturing artifacts are validated by the verifier hat (`hats/verifier.md`). The verifier checks **preconditions stated, action unambiguous, post-condition mechanically decidable with audit-trail evidence, rollback / scrap-policy declared where applicable** — body-content checks only, no frontmatter interpretation.

## Anti-patterns

- **No rollback / scrap policy.** A non-idempotent assembly step (board reflow, conformal coat) MUST state what happens to a unit that fails the post-condition — scrap, rework, or quarantine. Silence here ships defective product.
- **Vague yield gates.** "Yield is acceptable" is not a check; "yield ≥ 95% on 100-unit pilot, computed as `passed / total`, recorded in `manufacturing/yield-pilot-001.csv`" is.
- **Treating FAI as a formality.** First-article inspection is the last gate before tooling and process lock in. Every measurement must be logged and signed.
