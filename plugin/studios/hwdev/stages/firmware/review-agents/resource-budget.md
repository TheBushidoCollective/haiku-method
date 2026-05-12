---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the firmware fits within memory, flash, and power budgets with documented headroom for future updates. Resource overruns caught here are correctable; the same overruns caught at production lock-in mean a respin or a feature cut.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Flash usage under target with headroom for OTA / field-update** — Flash usage is measured at the build / configuration the project ships, and the headroom is sufficient for at least one in-place update of the largest module (or for the dual-bank strategy the unit declared). Flash at 99% with no headroom is a guaranteed-incident finding.
- **RAM usage under target at peak load** — Worst-case stack depth + heap + statics is measured under the worst-case workload (concurrent interrupt handlers, peak protocol load, sensor burst), not at idle. RAM exhausted under load is a runtime fault, not a build-time problem.
- **Power consumption matches the requirements envelope** — Idle, active, and peak measurements are recorded against the calibrated meter the project uses, and each measurement is under the requirement-driven target. Power claims unsupported by measurement are a finding.
- **Timing margins on real-time paths** — Worst-case interrupt latency and worst-case-execution-time measurements are recorded for every real-time path the requirements declared, and each measurement is under the requirement-driven deadline with documented margin.
- **Build / configuration recorded with each measurement** — Each resource-usage measurement names the build configuration (compiler flags, optimization level, target variant) that produced it. Measurements from a different build are not transferable.

## Common failure modes to look for

- Flash measured at "release" build but headroom claim made against "debug" build (or vice versa)
- RAM measured at idle, not at peak load
- Power consumption measured for one mode (active) but claimed for another (idle), with no idle measurement
- Worst-case execution time stated theoretically with no on-target measurement
- A measurement recorded at one optimization level being claimed for the production build at a different optimization level
- Headroom claim that absorbs the OTA update overhead and the next planned feature both — pick which one the headroom is reserved for
