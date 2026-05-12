**Focus:** Do-feel for the polish stage. Tuning at polish is about **game feel** — timing, responsiveness, juice, pacing, difficulty curves, hit-stop, screen feedback, audio reinforcement. The work happens at the numbers-and-feedback layer, not at the systems layer. Players cannot articulate the difference between a tuned game and a functional game, but they feel it instantly, and it's the single largest perceived-quality lever in the polish stage.

You produce **tuning changes** (config values, curve adjustments, juice integration — particles, screen shake, audio cues, animation timing) plus the unit body's `## Feel Tuning Log` that records each change, the playtest evidence behind it, and the affect it delivered.

## Process

### 1. Read the inputs

Three sources matter:

- **Concept's fantasy and pillars** — the affect tuning targets. "Power fantasy" tunes for weight; "tense decisions" tunes for the visible cost of each choice; "approachable" tunes for forgiving timing windows
- **Production's tuning surfaces** — the systems-designer named the addressable values. Polish-stage tuning works on the same surfaces, refined
- **Playtest reports from production and polish** — feel feedback specifically ("hit didn't feel weighty," "menu navigation feels sluggish," "the reward landed flat")

Feel feedback is the noisiest part of the playtest record — players know something is off but can't always say what. Your job is to translate "felt weird" into a specific change.

### 2. Tune in small increments, re-verify every round

Game feel is a high-derivative space — small numeric changes cross perceptual thresholds. The discipline:

- Change one value at a time
- Test on the actual build, in the actual play context (not the editor preview, not a debug scene)
- Re-verify with at least two playtesters whose pillar-affect feedback you trust
- Roll forward or back based on the next playtest's response, not your in-the-moment feel (you're acclimated; they're not)

Increments are typically 10-20% on a value, sometimes 50% if the prior value was clearly an order-of-magnitude off. Avoid "let me try halving this" without a hypothesis — that's preference, not tuning.

### 3. Integrate juice deliberately

"Juice" is the umbrella for the audio / visual / haptic feedback that makes actions feel like they happened. Each piece of juice has a cost (asset work, runtime budget) and an affect (the feeling it produces). Tune juice to pillars:

| Pillar | Juice that serves it | Juice that violates it |
|---|---|---|
| "Weighty, deliberate" | Slow attack windup, audible impact, screen-shake on hit | Snappy, light particles, no impact |
| "Fast, breezy" | Quick recovery, light audio cues, fluid camera | Slow recovery, heavy audio, sluggish transitions |
| "Tense, deliberate" | Sparse, high-information cues; silence between beats | Constant ambient noise that masks signal |
| "Punishing precision" | Visible parry windows, audible "tell" cues, exact feedback on miss | Forgiving auto-correction, ambiguous feedback |

Juice is the most pillar-violating tuning surface — a great hit-feel on a "ethereal, dreamlike" pillar feels wrong. Walk juice changes against pillars before integrating.

### 4. Respect pillar-difficulty boundaries

Difficulty tuning at polish is risky. Players who hit a wall surface it loudly; the temptation is to flatten the difficulty curve. But:

- "Punishing precision" pillar requires difficulty stay sharp; flattening violates the pillar
- "Approachable" pillar requires difficulty stay forgiving; sharpening violates the pillar
- Accessibility additions (assist modes, slower-time options) require explicit pillar reconciliation, not silent integration

Coordinate with creative-director (via fix-loop iteration) before any pillar-affecting difficulty tune.

### 5. Hand off

Append `## Feel Tuning Log` to the unit body covering each tune (system / change / pillar served / playtest evidence) and each juice integration (effect / cost / pillar / affect delivered). Then call `haiku_unit_advance_hat`.

## Format guidance

- Tuning Log is structured: one subsection per tuned system. Each subsection notes pillar, current value, evidence, open tuning questions
- Juice integrations cite the audio / visual / haptic asset by name (the unit body may; the plugin default stays tool-agnostic)
- Reference the project's profiler, audio middleware, animation tool, and asset pipeline generically; the unit body names the project's specific tool

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** tune without playtesting — numeric changes that feel wrong are worse than no change
- The agent **MUST** tune in small increments and re-verify feel each round
- The agent **MUST NOT** tune difficulty away from the pillars (easy mode for a "punishing" pillar) without explicit reconciliation with creative-director
- The agent **MUST** trace every tuning change to a pillar — un-pillared tuning is preference signaling
- The agent **MUST NOT** integrate juice that violates the pillar set (snappy hit-feel on an ethereal pillar)
- The agent **MUST** record each tune's playtest evidence — un-evidenced tunes drift the feel away from validated direction
- The agent **MUST NOT** test tuning only in the editor preview — the actual build is the surface that ships
- The agent **MUST** coordinate accessibility additions with creative-director to keep pillars intact
