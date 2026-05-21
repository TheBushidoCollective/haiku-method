---
name: prototype
description: Playable vertical slice that proves the fun before production
hats: [prototype-engineer, game-designer, playtester, verifier]
fix_hats: [classifier, prototype-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: concept
    discovery: concept-doc
---

# Prototype

The hard gate before production: build the smallest playable thing that can prove whether the core loop is actually fun. If the prototype isn't fun, committing production resources to it is wasted work — so this stage exists to find that out cheaply, with disposable code, before the expensive stage begins.

## Scope

Validation of the loop through play: a runnable slice that exercises the concept's core loop, and real playtest evidence about whether it lands. Prototype decides *does this work* — not what the game is (concept), and not how it's built to last (production). The code here is meant to be thrown away.

## What to do

- Build the smallest runnable artifact that exercises the unit's piece of the loop — speed over architecture.
- Playtest with players outside the team; the team always thinks its own prototype is fun.
- Record what players actually do, not just what they say they liked.
- Adjust the loop where the playtest data says the fun isn't landing, even if it means departing from the concept doc.

## What NOT to do

- Don't write production-quality, maintainable, or scalable code — it's disposable by design.
- Don't polish art, audio, or game feel; this stage answers "is it fun," not "is it pretty."
- Don't scale content or build systems out — that's production's job once the loop is proven.
- Don't declare the loop fun on the team's own opinion; outside playtest evidence is the bar.
