---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the report accurately represents project state — health indicators use objective thresholds, forecasts use actual velocity, audience-tailored views are consistent with the underlying dashboard, and decisions needed are surfaced with owner and deadline. The failure mode this lens catches: a report that looks polished while the underlying signal has been smoothed away.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Objective health thresholds** — every health indicator has a numeric or boolean rule that decides the color. Subjective ratings (`"Going well"`, `"Some concerns"`, `"We feel good"`) are rejected.
- **Threshold-to-data consistency** — the health indicator color matches what the threshold rule applied to the current data would produce. A green indicator on data that meets the amber threshold is rejected.
- **Forecast on actual velocity** — forecasts are computed from current trajectory, not the original plan. A forecast that equals the baseline when the data says otherwise is rejected.
- **Forecast-vs-baseline delta shown** — the delta between forecast and baseline is shown explicitly, not buried in narrative. Hidden slip is rejected.
- **Audience-view consistency** — the headline / summary / detail reports tell the same story. Contradictions across surfaces (summary says green, detail says amber) are rejected.
- **Metric-to-criterion trace** — every metric on the dashboard traces to a charter success criterion or a known risk. Metrics that exist for their own sake are flagged for confirmation.
- **Decisions surfaced** — required decisions and action items appear at the top of each audience's view, with owner, deadline, and consequence-of-delay. Decisions buried in narrative are rejected.
- **No good-news-only pattern** — amber and red statuses appear with the same prominence as green. Soft-pedaling of problems is rejected.
- **Cadence map present** — the report names cadence and off-cycle communication triggers for each audience.

## Common failure modes to look for

- A green headline with amber or red signals inside the detail view
- Forecasts that mysteriously match the baseline despite the underlying tracking showing slip
- A "we're on track" narrative paired with a forecast-finish date that's 10+ days past the baseline
- Subjective health ratings that have crept in alongside the objective ones, with no rule for picking the color
- Required decisions mentioned in passing inside a status paragraph instead of surfaced in a structured decisions-needed section
- Audience-specific reports that have visibly drifted from each other (executive view shows different numbers than the team view)
- Forecasts based on the original plan instead of actual velocity (a classic "we'll catch up" projection with no basis in the data)
- A dashboard with 25+ metrics — signal lost in noise
- An amber or red status with no decision-maker named, leaving the action implicit
