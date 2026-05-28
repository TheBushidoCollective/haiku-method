# Production Stage — Elaboration

## Criteria Guidance

Production scales the validated prototype to the full game. Scope discipline is the cross-cutting constraint — every gate must distinguish "implementing what the concept doc and prototype validated" from "inventing new mechanics during production." New mechanics in production are scope creep; gates should make that visible, not invisible.

The verify-command examples below illustrate the **pattern**. Map them to the engine and pipeline the team is using.

### Good — criterion paired with verifying command

- "Implementation matches the validated prototype's core loop — no scope additions"
  - Concept-doc mechanics list as the source of truth: `diff <(jq -r '.mechanics[].name' concept.json | sort) <(jq -r '.mechanics[].name' production-manifest.json | sort)`
  - Non-empty diff requires explicit `concept-doc-amendment.md` with sign-off

- "Production code matches the established quality bar"
  - Unity: `Unity -batchmode -runTests -projectPath . -testPlatform EditMode` exits 0 + lint passes
  - Unreal: `UE5Editor -ExecCmds="Automation RunTests" -unattended` exits 0
  - Bevy/Rust: `cargo test --release` exits 0 + `cargo clippy -- -D warnings` exits 0

- "Content beats from the concept doc are all implemented" — paired with a structural check against the beat manifest:
  - `[ $(jq -r '.beats[] | select(.implemented == false) | .name' beats.json | wc -l) -eq 0 ]`

- "Asset budget is respected on the target platform"
  - Texture/audio/mesh size budgets: `python tools/budget-check.py --platform <target> --max-mb <N>` exits 0
  - Memory profile at expected play length: `python tools/memory-profile.py --duration 30m --max-mb <N>` exits 0

- "Performance meets target on minimum-spec hardware" — paired with an FPS-floor check:
  - `python tools/perf-check.py --target-fps 60 --min-fps 50 --scene <scene>` exits 0

### Bad — vague (no clear check)

- "Game is feature-complete" — against what feature list? Concept doc? Production manifest?
- "Code is production quality" — proven by what? Test coverage threshold? Lint warning count?
- "Content is in" — how many beats? Which scenes? Against what manifest?
- "Performance is acceptable" — needs FPS floor + measurement command on named hardware

## Per-unit framing

Production units are the longest of the gamedev lifecycle. The `## Implementation notes` section MUST sequence systems-before-content (engineering foundations before the content team scales on top), and the `## Completion criteria` MUST pair gameplay correctness with at least one performance and one scope-fidelity check.

Cross-stage: prototype's recorded `playtest-report` is the validation baseline. If a unit's design diverges from what prototype proved, the unit body MUST cite the prototype finding that justifies the change — or the change is scope creep.
