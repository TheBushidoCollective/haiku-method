---
interpretation: lens
---

**Mandate:** The agent **MUST** verify production work adheres to the pillars defined in concept. Content and systems that drift from pillars produce tonal whiplash and weaken the finished game. Pillar drift is invisible to engineers working close to the code and to designers tuning specific curves; this lens catches drift before it compounds across the build.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Every new system reinforces (or at minimum does not violate) a named pillar.** The systems log declares which pillar each system serves. If a system serves no pillar, it is decorative; if a system contradicts a pillar, it is drift. Either way, finding.
- **Tuning curves serve the pillar they claim to serve.** A "tense resource decisions" pillar is contradicted by an economy curve that makes resources trivially abundant. A "power fantasy escalation" pillar is contradicted by a player capability curve that plateaus before the threat curve does. Walk each curve against its claimed pillar.
- **Content delivers the fantasy the pillars promise.** A pillar like "I feel like a precision predator" requires content (encounters, audio cues, visual feedback) that puts the player in the predator role. Content that frames the player passively (cutscenes do the action, the player watches) does not deliver the fantasy even if pillars are claimed in the manifest.
- **Tonal consistency across content authors.** Different hands tend to drift tonally. A horror beat in a cozy game and a cozy beat in a horror game both undermine the pillar set. Walk the content manifest's tonal references; flag inconsistencies between sibling units.
- **No pillar is being silently abandoned.** Every pillar from concept must appear somewhere in the production stage's systems / tuning / content. A pillar that nothing in production serves is a pillar concept thought was important and production let drop — that's a concept-revision conversation, not a silent omission.
- **Cross-pillar interactions are preserved.** Concept pillars often interact (e.g., "permanent consequence" + "tense decisions" = the resource cost outlasts the level). If production split the pillars across systems that don't talk to each other, the interaction is lost.

## Common failure modes to look for

- A system added in production with no pillar mapping in its log
- A tuning curve whose shape contradicts the pillar it claims to serve
- A content piece authored against a tonal reference that contradicts another sibling unit's reference
- A pillar from concept that no production unit names — silent abandonment
- A "fantasy-delivering" cutscene that frames the player as observer rather than agent
- Difficulty modes added that violate the pillar's promise (e.g., "skip combat" toggle in a combat-focused game) without an explicit pillar reconciliation
- New mechanics or systems that were not in the validated prototype — pillar alignment can't be evaluated on un-validated additions, so they need to route through scope-discipline first

When a finding is identified, file feedback against the specific production unit (system, tuning, content) where the drift lives, not against the stage in aggregate. When the drift reveals a concept-level pillar tension that production cannot resolve, file feedback against the concept stage.
