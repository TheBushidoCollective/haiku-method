---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the research brief covers the problem space without significant blind spots. Thoroughness is the lens — incomplete research becomes confident-sounding deliverables built on partial evidence, and the cost compounds across `create`, `review`, and `deliver`.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Source diversity** — Each non-trivial claim is supported by sources drawn from substantively different classes (e.g., primary documentation + analyst opinion + dated stakeholder conversation). Multiple sources from one class do not satisfy this; the diversity, not the count, is what matters.
- **Prior art surveyed** — The research brief explicitly addresses prior comparable work (existing solutions, competing approaches, internal prior attempts). Reinventing a known solution because the prior work wasn't surfaced is a thoroughness gap.
- **Contradictions surfaced and reconciled** — Where sources disagree, the brief either picks a side with justification or defers explicitly. Silent resolution of contradictions is a violation.
- **Assumptions stated explicitly** — Load-bearing assumptions are named in the brief, not buried inside the analysis. Implicit assumptions become invisible failure modes downstream.
- **Knowledge gaps named** — Areas the research couldn't cover are listed with the specific next step that would close each one (named source class, named stakeholder, named query). "Further research needed" is not a closed gap.
- **Per-topic coverage** — Each topic unit's body delivers substantive findings, not a placeholder, an outline, or a redirect to "see other unit."

## Common failure modes to look for

- A claim sourced only to "industry common knowledge" or a generic statistic without a traceable primary
- A pattern claimed to be "widely observed" but evidenced from one source class (e.g., five analyst reports all citing the same primary study)
- A contradiction visible across sources that the brief silently resolved in favor of the more convenient side
- A "prior art" section that lists prior work but doesn't actually compare against it
- An assumption that's load-bearing for downstream stages but only stated inside a footnote or parenthetical
