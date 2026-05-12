# Reconnaissance Stage — Execution

## Per-unit baton (`osint-analyst → network-mapper → verifier`)

Each unit walks the three hats in order. The baton is the unit's accumulated body content:

1. **`osint-analyst` (plan):** collects the public-source pool for this unit's surface — DNS, certificate transparency, WHOIS, public web presence, public code, public leak presence (without value capture). Hands off with `## OSINT Pool` populated and `## Open Questions` listing thin axes.
2. **`network-mapper` (do):** plans active probes from the OSINT pool, confirms ROE authorization for active probing, executes within the agreed window, and produces the `## Target Profile` — live hosts, exposed services, technology fingerprints, ingress map, probe log. Confirmed-vs-inferred is distinguished explicitly.
3. **`verifier` (verify):** body-only validation — does the artifact answer its topic, are sources cited, is it internally consistent, are open questions accounted for? Advances on pass, rejects with the responsible hat named on fail.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review** — universal hard gate; built-in spec-conformance subagent confirms the stage's artifacts conform to the intent's spec.
2. **Quality review** — the stage's `coverage` review agent fires; files feedback if any in-scope surface is unrepresented, if passive+active wasn't applied, or if asset categorization is missing.
3. **Fix loop** — `[classifier, osint-analyst, feedback-assessor]` dispatches per finding. `osint-analyst` is the implementer because most findings ask for additional collection or follow-up probing.
4. **Gate** — `auto`. Knowledge-artifact findings at this stage are downstream-catchable; the gate doesn't require human triage.
