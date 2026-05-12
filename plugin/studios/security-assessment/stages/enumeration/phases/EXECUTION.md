# Enumeration Stage — Execution

## Per-unit baton (`enumerator → vulnerability-scanner → verifier`)

Each unit walks the three hats in order. The baton is the unit's accumulated body content:

1. **`enumerator` (plan):** deep-dives into the unit's service category from the upstream target profile — confirmed versions, protocol options, auth mechanisms, exposed functionality, configuration tells. Confirmed-vs-inferred is distinguished. Hands off with `## Service Inventory` populated.
2. **`vulnerability-scanner` (do):** correlates the inventory against known vulnerability classes (OWASP Top 10, CWE families, vulnerability-database references when real), triages for false positives, and produces `## Vulnerability Catalog` entries with confidence ratings and environmental severity.
3. **`verifier` (verify):** body-only validation — substance, citation, false-positive triage, consistency. Advances on pass, rejects on fail with the responsible hat named.

## After execute completes

When every unit's hat chain has terminal-advanced:

1. **Spec review** — universal hard gate.
2. **Quality review** — the stage's `false-positive-check` review agent fires; files feedback if confidence ratings are inflated, confirmation paths are missing, severity isn't environmentally adjusted, or CVE references aren't real.
3. **Fix loop** — `[classifier, enumerator, feedback-assessor]` dispatches per finding. `enumerator` is the implementer because most catalog findings need re-triage or additional service-detail collection.
4. **Gate** — `ask`. Human triage of "what's worth attempting to exploit" is the most expensive cost in the engagement; the catalog gets human sign-off before exploitation spends time on PoCs.
