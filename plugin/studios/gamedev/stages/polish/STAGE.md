---
name: polish
description: Tuning, game feel, performance, bug triage, and juice
hats: [gameplay-engineer, tuner, performance-engineer, qa]
fix_hats: [classifier, gameplay-engineer, feedback-assessor]
review: [external, ask]
elaboration: collaborative
inputs:
  - stage: production
    output: game-build
---

# Polish

The stage that trades time for perceived quality: tune game feel, fix bugs, hit platform performance targets, and add the juice that makes a hit register and a pickup feel satisfying. Players can't articulate the difference between a great game and a polished great game, but they feel it — it's the difference between a 70 and an 85.

## Scope

Refinement of the existing build: feel tuning, bug fixing, performance optimization, and final audio/visual feedback. Polish decides *how good the finished game feels* — not what content exists (production already built it), and not how it ships (release). Nothing new gets added here.

## What to do

- Fix gameplay bugs and edge cases surfaced by playtests and QA; polish-phase engineering is reactive, not new construction.
- Tune feel — timing, responsiveness, juice, pacing, difficulty curves — to close the gap between functional and great.
- Optimize to meet platform performance targets: frame rate, load times, memory, thermals on handhelds and mobile.
- Validate every fix on the actual build before treating a unit as polish-complete.

## What NOT to do

- Don't add new content — in polish it rarely ships at quality and almost always pushes the release date.
- Don't reopen production-scope systems work or rebuild what production delivered.
- Don't certify a fix you only verified on a dev build.
- Don't carry an unresolved regression into release.
