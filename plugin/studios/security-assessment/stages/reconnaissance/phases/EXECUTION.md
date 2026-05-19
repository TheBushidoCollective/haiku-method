# Reconnaissance Stage — Execution

## Per-unit baton (`osint-analyst → network-mapper → verifier`)

Each unit walks the three hats in order. The baton is the unit's accumulated body content:

1. **`osint-analyst` (plan):** collects the public-source pool for this unit's surface — DNS, certificate transparency, WHOIS, public web presence, public code, public leak presence (without value capture). Hands off with `## OSINT Pool` populated and `## Open Questions` listing thin axes.
2. **`network-mapper` (do):** plans active probes from the OSINT pool, confirms ROE authorization for active probing, executes within the agreed window, and produces the `## Target Profile` — live hosts, exposed services, technology fingerprints, ingress map, probe log. Confirmed-vs-inferred is distinguished explicitly.
3. **`verifier` (verify):** body-only validation — does the artifact answer its topic, are sources cited, is it internally consistent, are open questions accounted for? Advances on pass, rejects with the responsible hat named on fail.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coverage` review agent and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `coverage` review agent and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → osint-analyst → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `osint-analyst` is the implementer (most findings ask for additional collection or follow-up probing); the assessor independently decides closure.

6. **Gate** — The stage's gate is `auto`. Knowledge-artifact findings at this stage are downstream-catchable; the gate doesn't require human triage.
