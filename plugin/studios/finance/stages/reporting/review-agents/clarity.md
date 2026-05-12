---
interpretation: lens
---
**Mandate:** The agent **MUST** verify financial reports match their audience, that visualizations don't distort the underlying data, and that every number traces to a verified source. A report that fails this lens either gets ignored by its audience (wrong detail level) or — worse — leads to a decision based on a misleading chart.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Audience fit** — each report names its primary audience explicitly (executive / departmental / finance-partner / external) and its structure matches that audience. Executive reports don't carry full detail tables; finance-partner reports don't elide the underlying numbers.
- **Source traceability** — every material number references its source artifact (specific variance row, forecast scenario, budget line). A number with no source is a finding.
- **Visualization integrity** — bar and stacked charts use full zero-based axes; multi-axis charts label both axes clearly; logarithmic axes are explicitly labeled. Truncated axes on bar charts are the canonical misleading-chart pattern and are a finding wherever they appear.
- **Visual consistency** — series colors, number formats, date formats, and label conventions are consistent across the dashboard. Inconsistency between related charts misleads the reader on the comparison.
- **Accessibility of favorable / unfavorable signals** — color alone (red / green) is insufficient; reports MUST add a second signal (icon, position, label) so color-blind readers and grayscale prints stay legible.
- **Forward-looking commentary** — backward-looking sections are paired with brief forward-looking context anchored to the forecast. Reports with only lagging indicators are incomplete.
- **Required disclosures** — for any report that goes outside the company, the required disclosures are present and complete. Internal restatements (re-stated comparatives, changed accounting policies) are surfaced explicitly.

## Common failure modes to look for

- An executive report with five pages of detail tables — wrong audience fit
- A bar chart whose y-axis starts at a non-zero value to exaggerate the period's change
- A dashboard where the same data series uses different colors across two adjacent charts
- A number in narrative ("revenue was up 12%") with no link to a source artifact
- A restated comparable (`"prior period: $X (restated)"`) without an explanation of what was restated and why
