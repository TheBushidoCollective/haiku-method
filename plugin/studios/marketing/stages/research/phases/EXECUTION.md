# Research Stage — Execution

## Per-unit baton (`market-researcher → audience-analyst → verifier`)

Every research unit walks the three hats in order. The baton is the unit body itself, evolving as each hat appends:

1. **`market-researcher` (plan + do for evidence):** Reads the unit's topic question, frames scope and "what good evidence looks like", and produces the sourced competitive / category / audience-signal block. Hands off when every non-trivial claim is cited and gaps are named rather than papered over.
2. **`audience-analyst` (do for distillation):** Reads the upstream evidence and produces the structured audience artifact — segments with all five dimensions, validation against the evidence, mapping onto the positioning terrain. Hands off when every segment is evidence-backed and the positioning openings are named.
3. **`verifier` (verify):** Reads the artifact body and runs the substance / citation / consistency / decision-register / open-questions checks defined in `hats/verifier.md`. Advances on pass, rejects to the responsible hat on fail.

The hat order is `plan → do → verify` because researcher produces the evidence the analyst distills: evidence is the plan, the structured audience artifact is the do, the substance check is the verify.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `rigor` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `rigor` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → market-researcher → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `market-researcher` is the implementer (re-authors against the cited gap); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Research findings advance without explicit human signoff; the strategy stage's collaborative elaboration is where humans engage with the conclusions.

## Reviewer guidance specific to this stage

- **Unsourced numbers** are the single highest-priority finding. The whole point of research is the citation chain; a number without a source breaks the chain and corrupts every downstream decision built on it.
- **Demographic-only segments** are next. Strategy built on demographics produces messaging that's targeted to nobody.
- **Missing adjacent players** show up as audience-expectation mismatches later — the strategy chooses positioning the audience has already filed mentally under "indirect competitor".
- **Conclusions one source thick** are not conclusions; they're hypotheses dressed up. Surface them as such or strengthen the evidence.
