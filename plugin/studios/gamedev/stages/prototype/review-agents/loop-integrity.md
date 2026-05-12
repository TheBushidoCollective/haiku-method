---
interpretation: lens
---

**Mandate:** The agent **MUST** verify the prototype actually exercises the core loop as defined in the concept doc, not a simpler loop or a different loop. A prototype that validates *some* fun by cutting the hard parts of the loop validates the wrong thing — production then scales the cut-down loop and the original pillars are silently abandoned.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Every element of the concept's core loop is present in the slice.** The concept stage's core-loop spec named the minute-to-minute actions, the hour-to-hour rhythm, and the session-to-session return. The prototype slice may scope down on the hour and session scales, but the **minute-scale loop must be complete** — every action, every consequence, every return-to-loop transition. A prototype missing the consequence step has not tested the loop.
- **Playtesters experienced the full loop, not a subset.** The playtest record's behavior summary names every loop element each player encountered. If the loop has four actions and sessions only exercised three, the validation is partial and the missing action's role is untested.
- **Cuts and stubs are named, not silent.** The prototype-engineer hat's build log declared what was stubbed. Anything stubbed that participates in the core loop (not just art / audio / level dressing) must be called out as a validation gap. "We stubbed the consequence feedback" means the consequence step was not actually tested even if the action ran.
- **The slice's loop is the concept's loop, not a simplified variant.** If the prototype-engineer cut the loop because it was hard to build in the slice, that's a finding. Concept claims rest on the loop as defined; a different loop tests different claims.
- **The fantasy is delivered by the loop's actions, not by ambient framing.** A prototype that delivers fantasy through cutscenes, narration, or backstory but not through the player's actions has not validated whether the loop carries the fantasy.
- **Cross-pillar interactions are present where the concept named them.** If two concept pillars interact (e.g., "permanent consequence" + "tense resource allocation" = the resource cost outlasts the level), the slice must exercise the interaction, not just the pillars in isolation.

## Common failure modes to look for

- A "core loop" in the slice that has fewer actions than the concept's core-loop spec
- Sessions that touched some loop actions but not others, with no acknowledgment in the record
- A stub on a loop-critical element (consequence feedback, resource UI, escalation curve) that the validation did not flag
- A pillar that interacts with another pillar in concept but appears alone in the slice's design
- Fantasy delivered through framing (intro cinematic, voiceover, written context) rather than through gameplay actions
- A faster, simpler loop emerged in iteration and replaced the concept's loop without a corresponding concept-stage finding being filed

When a finding is identified, file feedback against the prototype unit whose slice scope is the problem. When the finding reveals the concept's loop itself is unbuildable at this budget, file feedback against the concept stage so the loop can be revised at the right layer.
