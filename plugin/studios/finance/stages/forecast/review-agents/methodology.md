---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the forecast model rests on a named methodology and explicit assumptions, with scenarios that differ in substance rather than scale. A forecast that fails this lens propagates unmodeled risk into every downstream stage — the budget envelope, the variance baseline, and the close exception tolerance all anchor to it.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Methodology named** — the model declares which projection methodology it uses (driver-based, top-down × bottom-up reconciliation, or a defensible hybrid) and explains why that methodology fits the slice being projected. Time-series extrapolation may appear as a sanity check but MUST NOT be the primary method for a forward forecast.
- **Assumptions explicit per driver** — every projected number traces to a named driver and a stated assumption (not a formula buried in a spreadsheet cell). A reviewer can read the model body and identify what would have to change for each number to move.
- **Distinct scenario assumption sets** — base / optimistic / pessimistic differ in the underlying assumption set, not just by a scaling factor. A "high case = base × 1.10" is a sensitivity, not a scenario.
- **Sensitivity output present** — for each scenario, the two or three load-bearing assumptions have explicit sensitivity output (e.g., output under win-rate = 18% / 22% / 26%). Sensitivity identifies which assumptions actually matter.
- **Confidence stated per scenario** — qualitative confidence per scenario, anchored to evidence (data stability, comp data availability, structural-change exposure). Missing confidence flags downstream as undefined risk.
- **Data sources reliable and recent** — every assumption cites a data source from the analyst hat's foundation; reliability is stated; refresh date is current relative to the projection horizon.

## Common failure modes to look for

- A scenario set where optimistic and pessimistic are mechanically symmetric around base — surface signal of a missing risk model
- An assumption stated without a data source — typically marks an opinion masquerading as a projection
- Sensitivity output that only varies one assumption while holding everything else flat — misses interaction effects on the load-bearing pair
- A driver with no plausible leading indicator and no explicit acknowledgment that the slice will lag
