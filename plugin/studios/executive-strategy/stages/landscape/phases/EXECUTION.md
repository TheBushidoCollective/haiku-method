# Landscape Stage — Execution

## Per-unit baton (`strategist → analyst → verifier`)

Every landscape unit walks the three hats in order. The baton is the unit's body content evolving across the rally race:

1. **`strategist` (plan):** Reads the unit's topic shell and the intent's strategic question. Writes the framing — scope, time horizon, decision linkage, key questions, and the structuring framework (SWOT / Porter / PESTEL / scenario / capability map). Hands off when the framing is concrete enough that an analyst can know what evidence to gather.
2. **`analyst` (do):** Reads the strategist's framing. Gathers evidence against each key question, validates source credibility, documents data gaps, and synthesizes the landscape view following the named framework. Hands off when every key question has a substantive answer with cited sources and the synthesis is a point of view, not a data dump.
3. **`verifier` (verify):** Reads the unit body. Checks substance, citation, internal consistency, and decision-register accountability per the body-only mandate. Either advances (substance is sufficient) or rejects with the responsible hat named (rewinds within the unit).

The hat order is `plan → do → verify` because framing the topic decides what evidence matters; without it the analyst has no target.

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate. The built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review (parallel)** — The stage's `rigor` review agent fires alongside any studio-level review agents. Findings file as feedback.
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, strategist, feedback-assessor]` dispatches per finding. The classifier routes the FB to the right unit. `strategist` is the implementer (re-framing or pointing at the evidence gap). The assessor independently decides closure.
4. **Gate** — The stage's gate is `auto` — once verifier hats advance and review agents are clean, the workflow engine merges and moves on without human approval. The landscape stage is structurally upstream of where most strategic-decision risk lives; gating here would add friction without catching the failures that actually matter.

## Reviewer guidance specific to this stage

- **Numerical inconsistency across sibling units** is the highest-priority finding — if two units in the same stage cite a competitor's revenue or a market size differently, downstream stages will pick the wrong one.
- **Data dump masquerading as synthesis** is next — a unit that has every section populated but no point of view tying them together is a coverage gap, not a complete unit.
- **Framework-fit failures** (forcing SWOT onto a regulatory landscape, etc.) compound into evaluate-stage confusion.
- **Decision-linkage gaps** — a landscape surface that doesn't tie to any downstream decision is academic; flag it before it becomes weight the next stages have to carry.
