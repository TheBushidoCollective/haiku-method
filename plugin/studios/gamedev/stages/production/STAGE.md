---
name: production
description: Content and systems at scale
hats: [gameplay-engineer, content-author, systems-designer, reviewer]
fix_hats: [classifier, gameplay-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: concept
    discovery: concept-doc
  - stage: prototype
    output: prototype
---

# Production

The longest stage of the gamedev lifecycle by a wide margin: scale the validated prototype into the full game. Build out content, implement systems at production quality, integrate art and audio, and deliver every beat the concept doc promised. The prototype defines what counts as "the game"; production's job is to scale that, not to reinvent it.

## Scope

Building the game at scale: production-quality systems, the content the player experiences, and the art and audio integration that fills out the concept's promised beats. Production decides *how the proven game gets built out* — not whether the loop is fun (prototype already settled that), and not the final-quality feel and certification (polish and release).

## What to do

- Reimplement the validated core loop at production quality and build the systems content leans on.
- Tune the interlocking systems — economies, progression, difficulty, meta-systems — at the math layer above individual mechanics.
- Author the player-experienced content (levels, encounters, narrative beats, audio cues) against those systems.
- Hold scope to the pillars and the prototype-proven loop; that's the load-bearing discipline of this stage.

## What NOT to do

- Don't invent new core mechanics — that's scope creep; defer it to a sequel or DLC unless it's cheap and load-bearing for an existing pillar.
- Don't reopen the concept's pillars or the prototype's validated loop to fit something you'd rather build.
- Don't treat final tuning, performance, and juice as in-scope here — that's polish.
- Don't ship content that misses a pillar the concept promised.
