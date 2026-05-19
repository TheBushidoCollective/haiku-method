# Enumeration Stage — Execution

## Per-unit baton (`enumerator → vulnerability-scanner → verifier`)

Each unit walks the three hats in order. The baton is the unit's accumulated body content:

1. **`enumerator` (plan):** deep-dives into the unit's service category from the upstream target profile — confirmed versions, protocol options, auth mechanisms, exposed functionality, configuration tells. Confirmed-vs-inferred is distinguished. Hands off with `## Service Inventory` populated.
2. **`vulnerability-scanner` (do):** correlates the inventory against known vulnerability classes (OWASP Top 10, CWE families, vulnerability-database references when real), triages for false positives, and produces `## Vulnerability Catalog` entries with confidence ratings and environmental severity.
3. **`verifier` (verify):** body-only validation — substance, citation, false-positive triage, consistency. Advances on pass, rejects on fail with the responsible hat named.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `false-positive-check` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `false-positive-check` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → enumerator → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `enumerator` is the implementer (most catalog findings need re-triage or additional service-detail collection); the assessor independently decides closure.

6. **Gate** — The stage's gate is `ask`. Human triage of "what's worth attempting to exploit" is the most expensive cost in the engagement; the catalog gets human sign-off before exploitation spends time on PoCs.
