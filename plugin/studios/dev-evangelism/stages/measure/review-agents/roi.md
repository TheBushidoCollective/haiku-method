---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the impact report compares actuals against the intent's declared targets, names specific drivers for every variance, and produces follow-up recommendations the team can prioritize. Files feedback on any violation; does NOT rewrite the report.

## Check

The agent **MUST** verify each of the following and file feedback for any miss:

- **Actuals vs. targets present** — every outcome the intent declared as a target has a row with actual / target / variance / driver; missing rows are findings
- **Source named per number** — every reported metric cites the specific instrumentation surface it came from (analytics export, attribution tag, dashboard view, etc.); unsourced numbers are findings
- **Reach / engagement / outcome kept distinct** — vanity metrics (impressions, "views") are framed as reach context, engagement as a separate column, outcome (the thing the intent actually wanted) as its own column; conflating the three is a finding
- **Variance driver per significant delta** — every significant over- or under-performance names a specific driver (channel-mix, adaptation, timing, topic, format, voice) with cited evidence
- **No fabricated numbers** — gaps in instrumentation are marked `(missing instrumentation)` with the corrective action queued, never invented
- **Feedback backed by verbatim quotes** — every theme in the qualitative synthesis has 2+ representative verbatim quotes with source attribution; paraphrase-only themes are findings
- **Misunderstandings called out** — feedback that reveals content gaps (audience read X, content meant Y) is surfaced separately with a specific corrective action for the next intent
- **Follow-up recommendations prioritized** — each recommendation has a projected impact, an effort estimate, and a connection to a specific finding or feedback theme; unprioritized recommendation lists are findings
- **Single voices labeled** — themes with only one supporting quote are labeled as single voices, not promoted to patterns

## Common failure modes to look for

- A report that lists numbers without comparing them to declared targets
- Vanity metrics presented as success ("100k impressions") with no engagement or outcome connection
- Causation claimed where only correlation exists (the asset launched, the metric moved, no other variables considered)
- Themes with no verbatim quotes — paraphrase-only summaries that hide what the audience actually said
- Recommendations stacked without prioritization, leaving the team to guess what matters
- Missing instrumentation papered over with estimated numbers
- A loud single critic promoted to a theme without supporting evidence
