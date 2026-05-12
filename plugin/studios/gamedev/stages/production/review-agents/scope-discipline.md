---
interpretation: lens
---

**Mandate:** The agent **MUST** flag any work that exceeds the scope envelope defined in concept and validated in prototype. Production is the stage where scope creep shows up; unchecked creep pushes the release date, starves polish, or ships a worse version of the originally scoped game. This lens is the last cheap line of defense before polish stage tries to land scope that should have been cut here.

## Check

The agent **MUST** verify, file feedback for any violation:

- **No new core systems beyond the validated prototype.** The prototype's playtest record named which systems were tested. Production systems must trace back to a validated prototype system or be a routine subsystem of one (e.g., "save / load" implementing the prototype's persistence assumption is fine; "branching dialogue tree" when the prototype had linear dialogue is a new system). New systems route through user-approved scope changes, not silent commits.
- **Content count matches the scope envelope.** Concept named content volume (levels, biomes, hours of play, mission count). The content manifest must total at or under the envelope. If a unit author argues the envelope was always too low, that's a concept-revision conversation, not a license to author over.
- **No "we should also add X" without an explicit scope-change approval.** Every addition that wasn't in concept's scope envelope OR in prototype's validated loop is a scope-change candidate. The unit body must cite a recorded scope-change approval (with date and approver) for any such addition. Unrecorded additions are findings.
- **Platforms match what concept named.** Concept declared target platforms (named generically — handheld, console, desktop, mobile, web). Production work tailored to a platform concept didn't name is platform creep, which compounds into porting cost.
- **Live-ops / post-launch features stay sized.** If the concept scope envelope did not include seasonal content, ranked play, or multiplayer modes, production additions in those directions are scope creep. The post-launch ongoing scope is part of the total scope number and gets the same discipline.
- **Cuts are happening if production is running hot.** The creative-director's reconciliation named a cut order. If production is over the time / budget envelope and no cuts have been recorded against that order, the team is missing the cuts side of scope discipline. File a finding to surface the gap to the user.

## Common failure modes to look for

- A new mechanic appearing in production that wasn't in the prototype's playtest record
- Content count above the scope envelope without a recorded scope expansion
- "Just one more level" / "while we're at it" patterns in design-iteration entries
- Platform-specific work (e.g., handheld optimizations, console-specific UI) without that platform appearing in concept's named list
- A live-ops or post-launch feature being scoped during production without recorded user approval
- Time / budget overruns with no recorded cuts against the named cut order
- Engineering-time spent on bespoke tooling for a content type concept didn't include

When a finding is identified, file feedback against the specific unit that introduced the scope addition, naming the recorded envelope being exceeded. When the scope expansion is large enough to require user decision, the finding should route up to the gate rather than be silently approved or rejected at unit level.
