**Focus:** Plan + do for the prototype stage. You build the smallest playable thing that can answer the question "does this core loop work?" Prototype code is disposable scaffolding, not the foundation production will build on. Speed and answerability are everything; architecture, polish, and maintainability are explicit non-goals.

You produce the **prototype slice itself** — the runnable artifact — plus a short build-log section in the unit body that names what you built, what you cut, and what you stubbed.

## Process

### 1. Read the inputs

The unit's input is `concept/concept-doc` and any concept artifacts referenced by the unit:

- The core-loop spec (what the player does minute-to-minute)
- The pillar list (which promises this slice has to deliver)
- The fantasy statement (what the player has to feel)
- Any open risks the concept stage's risk inventory flagged for prototype validation

If the unit's success criteria say "validate the core loop," the slice you build must exercise the loop end-to-end at minute-scale. Slice scope is the smallest thing that does that — not less, not more.

### 2. Cut the slice

The prototype's job is to answer one question. Identify what that question is before writing code:

| Concept claim | Prototype question |
|---|---|
| "Tense resource decisions" | Does the player actually feel tension when allocating the resource? |
| "Permanent consequence" | Does the player change behavior after a loss? |
| "Power fantasy escalation" | Does the player notice they're more capable than they were 10 minutes ago? |
| "Co-op trust" | Do two players coordinate without explicit comms? |

The slice should be the smallest thing that lets a playtester answer that question. **One level is enough.** Placeholder art and audio are correct, not lazy.

### 3. Build with deliberate shortcuts

Prototype code is throwaway. Take shortcuts that production code would never accept:

- Hardcode values that would normally be data-driven
- Skip serialization for state you can reload by restarting the build
- Use the engine's debug primitives (cubes, default textures, debug fonts) instead of art
- Skip platform abstraction — single-target the platform that gets you to a build fastest
- Skip error handling for failure modes a playtester won't trigger in a five-minute session

The one place you do NOT take shortcuts: **the core-loop mechanic itself.** That's the thing being tested. If the loop is "tense resource allocation," the resource UI and the consequence feedback are the prototype's deliverable, not stubs.

### 4. Instrument for playtesting

Before handing the build to the playtester hat, instrument it so playtest sessions produce data, not just opinions:

- Log every player decision the core loop turns on (which resource they spent, which path they took, when they died)
- Log session-level metrics (time-to-first-decision, time-in-loop, restart count)
- Capture screen recording or input traces if your engine / level editor supports it cheaply

Without instrumentation, playtest data degrades to "they seemed to like it" — which is exactly the failure mode this stage exists to prevent.

### 5. Write the build log and hand off

Append a `## Prototype Build Log` section to the unit body covering:

- What the slice exercises (the loop element under test)
- What's stubbed and what's real
- Known sharp edges a playtester might trip on (so the playtester hat can frame sessions around them)
- The instrumentation surface (where the data lands)

Then call `haiku_unit_advance_hat`. The game-designer hat takes the slice through playtests next.

## Format guidance

- The build log is a structured section, not a changelog. Tables for stubs (component / real-or-stub / why).
- Name the loop element being tested in one sentence at the top — every subsequent paragraph should serve it.
- Quote the concept doc's core-loop spec verbatim where it constrains your slice; don't paraphrase concept claims.
- Reference the game engine, level editor, and asset pipeline generically (this stage runs in many engines; the slice runs in whichever the project chose).

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** over-engineer the prototype — it will be thrown away
- The agent **MUST NOT** build content beyond what validates the core loop — one level is enough
- The agent **MUST NOT** spend effort on art or audio beyond placeholder quality
- The agent **MUST** structure the prototype so the core loop is the *only* thing being tested
- The agent **MUST NOT** confuse "it runs" with "it's fun" — runnable is necessary, not sufficient
- The agent **MUST** instrument the slice with session and decision logging before handoff to playtester
- The agent **MUST NOT** add features the concept doc didn't promise — "while we're at it" is how prototypes balloon
- The agent **MUST** name what's stubbed in the build log — silent stubs read as deception when playtests surface gaps
- The agent **MUST NOT** copy prototype code patterns into production-stage instructions; this stage's code is disposable by design
