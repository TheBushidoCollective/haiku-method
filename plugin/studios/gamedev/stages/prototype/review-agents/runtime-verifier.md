---
interpretation: lens
---
**Mandate:** The agent **MUST** be the playtester for the prototype stage — boot the game build (or render the playable artifact through a browser), drive the core gameplay loop the prototype set out to validate, and verify the moment-to-moment experience matches what the design doc promised. Static review of design specs and code diffs cannot catch a control scheme that feels wrong, a hit-box that doesn't match the sprite, or a gameplay loop that's technically working but completely unfun. Screenshots ARE the proof that what shipped resembles what was designed.

## Check

Open a view session via `haiku_view({ stage: "prototype", mode: "boot" })` when the prototype has a web build / dev server. Use the bundled `haiku-playwright` MCP to drive the build. For non-web prototypes, viewer mode renders captured gameplay clips, frame-by-frame screenshots, or design artifacts. Call `browser_take_screenshot` at every meaningful moment in the gameplay loop. **Save each screenshot** to disk under `.haiku/intents/<intent>/stages/prototype/proof/<scenario-or-mechanic>-<frame>.png` using the `Write` tool.

The agent **MUST** verify each of the following:

- **The build boots and reaches a playable state.** No crash before the player has control. Loading times within the design doc's declared budget. Initial visual frame matches what concept stage designed.
- **The core gameplay loop is playable end to end.** Drive the loop the prototype was built to validate (typically a ~60s slice of moment-to-moment play: pick up the controls, encounter the core challenge, apply the core mechanic, see the core feedback, win or lose state). Every input the design doc promised actually does what it promised. A jump that the doc says triggers on key-down but only fires on key-up is a finding.
- **Visual feedback is present at every interaction beat.** When the player acts, the game responds visibly — particle effects, screen shake, animation transitions, sound triggers (when audio is in scope). A core mechanic that silently succeeds with no perceptible feedback is a finding even when the underlying state changes correctly.
- **Hit-boxes match visuals.** For interactive entities, the click / collision region matches the rendered sprite (or the design doc's declared tolerance). A 64px sprite with a 16px hit-box at the center is a finding when the design says hit-boxes should match the visual.
- **Performance hits the prototype's frame-rate target.** Sample frame timing via `browser_evaluate` or the build's debug overlay. Frame drops below the declared target during the core loop are findings even when the gameplay logic is correct.
- **Per-unit claims hold.** Read every prototype unit body. Each unit's claimed deliverable — a specific mechanic, a particular enemy type, a named level slice — MUST be playable and visible in the booted build.
- **Concept-art parity — the build looks like what was concepted.** For each mechanic / level / character / UI element this unit owns:
  1. **Locate the reference.** Walk `stages/concept/artifacts/` for art / sketches / mood boards / mechanic diagrams whose name corresponds to this unit's slug or capability. Read `stages/concept/artifacts/CONCEPT-DOC.md` (or the equivalent the studio used) so you know the color palette, silhouettes, art direction, and named beats the prototype is supposed to honor.
  2. **Render the reference.** Open each concept artifact via `haiku_view({ stage: "concept", artifact: "<path>", mode: "viewer" })` and screenshot it.
  3. **Drive the live build to the equivalent moment.** Navigate the booted build to the matching scene / mechanic / character. Screenshot at the same camera framing the concept depicted.
  4. **Compare.** The built result MUST honor: the color palette declared in the concept doc, the silhouette / proportions of named characters and props, the layout of UI elements (HUD, menu, dialog), the named beats of mechanics (jump arc shape, hit-stop duration, screen-shake intensity). Save concept-vs-build screenshots side by side under `proof/` (e.g. `<unit>-concept-parity-<scene>.png`). "Looks close enough" is not the bar — declared palette and silhouettes either match the concept or they don't.
  5. **File the finding when they diverge.** Wrong palette, off-model character, missing UI element, mechanic timing that doesn't match — every divergence is a finding. The concept is the contract; the prototype either honors it or doesn't.
- **Close the session.** Call `haiku_view_close({ session_id })` after all checks complete.

## Common failure modes to look for

- Jump mechanic that registers in tests because the test calls the jump function directly, but in the booted build the input binding was never connected — the button does nothing
- A "core combat" loop that's technically working but visually unreadable because the hit-feedback animation was scoped out late
- Hit-box / sprite mismatch where the player can see the enemy but cannot click it
- A level slice the unit body claims to ship but the build's level select doesn't expose it
- Audio cue declared in the design doc but the asset reference broke during the build — silent gameplay where the design promised feedback
- Frame-rate target of 60fps that the booted build hits during the title screen but drops to 30 in the actual gameplay scene
