# Prototype Stage — Elaboration

## Criteria Guidance

The prototype's only job is to answer one question: does the core loop actually land with players outside the team? Every gate has to be testable in that frame — does the playtest produce a clean signal, not just a green checkbox.

The verify-command examples below illustrate the **pattern**. Map them to the engine and tooling the team is using (Unity, Unreal, Godot, Bevy, web-based), then write the gate against that.

### Good — criterion paired with verifying command

- "The slice runs end-to-end on the target platform without a hard crash"
  - Unity: `Unity -batchmode -runTests -projectPath . -testPlatform PlayMode` exits 0
  - Unreal: `UE5Editor -ExecCmds="Automation RunTests Game.Prototype" -unattended` exits 0
  - Web: `playwright test prototype-loop.spec.ts` exits 0

- "Playtest data exists for at least N sessions with players outside the team" — paired with a count check against the recorded sessions
  - `[ $(find playtest-logs/ -name 'session-*.json' | wc -l) -ge 5 ]`

- "Core loop is fun" — the actual gate the stage exists to answer. Pair with the structured playtest-report file:
  - `! grep -q 'fun_rating: <[1-3]>' playtest-logs/summary.md` (reject if any session rates fun < 4/5)
  - The structured playtest report MUST also surface where players disengaged and what they did instead.

- "The slice contains only the validated mechanics — no production-ready art, no scope additions"
  - Visual check via the playtester role + a manual diff against concept-doc's named mechanics list

### Bad — vague (no clear check)

- "The prototype works" — against what loop? for whom?
- "Playtesting is positive" — quantified how? Against what baseline?
- "The fun is there" — needs the structured rating + the disengagement-point capture
- "Scope is tight" — needs the named mechanics list from concept-doc and a check that nothing else landed

## Per-unit framing

Prototype units are unusually short on `## Implementation notes` (the engineer is making disposable code; sequencing is "fastest playable, then iterate") and unusually long on `## Completion criteria` (the playtest-signal contract). Quality gates here are mostly counts (sessions recorded, ratings collected) and report-shape checks rather than code-quality gates.

If a unit's verify path is "the playtester says yes," surface that explicitly as a `requires_human_review:` note in the unit body — the assessor reads it before closing.
