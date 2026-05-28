# Polish Stage — Elaboration

## Criteria Guidance

Polish trades time for perceived quality — tuning game feel, fixing bugs from QA and playtests, optimizing performance for target platforms, and integrating juice. The cross-cutting constraint is **no new content** — polish-phase additions rarely ship at quality and almost always push the release date. Every gate must distinguish "tuning an existing system or fixing a known bug" from "adding new scope under the polish banner."

The verify-command examples below illustrate the **pattern**. Map them to the engine and platform targets the team is shipping for.

### Good — criterion paired with verifying command

- "All P0 / P1 bugs from the production-stage QA pass are resolved"
  - Bug tracker integration: `jq -r '.bugs[] | select(.priority == "P0" or .priority == "P1") | select(.status != "closed") | .id' bugs.json | tee unresolved.txt && [ ! -s unresolved.txt ]`

- "Frame rate meets target on every supported platform"
  - Per-platform perf check: `python tools/perf-check.py --platform <p> --target-fps 60 --min-fps 55 --scenes all` exits 0
  - Handheld + mobile thermal profile: `python tools/thermal-check.py --duration 60m --max-temp 75` exits 0

- "Load times meet target"
  - Cold-start: `python tools/load-check.py --scenario cold-start --max-seconds <N>` exits 0
  - Scene-transition: `python tools/load-check.py --scenario scene-transition --max-seconds <N>` exits 0

- "Game feel matches the tuning brief"
  - Tuning targets file referenced from the unit body; tuner role records "before / after" measurements in the unit body
  - Manual playtester sign-off captured as a structured field in the unit body

- "No new content was added during polish" — paired with a manifest diff against the production-stage final manifest:
  - `diff production-final-manifest.json polish-current-manifest.json | grep -E '^[<>] *\".*\":' | grep -v fix\\| | (! grep .)`

### Bad — vague (no clear check)

- "Game feels good" — quantified how? Against what tuning brief? Whose sign-off?
- "Performance is improved" — improved against what baseline? On which platform?
- "Bugs are fixed" — which ones? Against what tracker query?
- "Juice is in" — needs explicit "before / after" capture or a checklist against the juice brief
- "Ready to ship" — what's the release-checklist gate?

## Per-unit framing

Polish units are unusual: most of them have NO new code structure to verify, just modifications to existing systems. The `## Implementation notes` section MUST name which existing systems are being touched and which are off-limits; the `## Completion criteria` MUST pair the tuning intent with a measurable check (FPS, load time, tuning-target diff, P0/P1 closure count).

Cross-stage: production's final manifest is the scope contract. Anything not present in that manifest is scope creep, full stop — the polish-phase classifier first-hat MUST reject feedback that asks for new content.
