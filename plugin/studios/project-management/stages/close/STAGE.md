---
name: close
description: Conduct retrospective, capture lessons learned, and handoff
hats: [closer, archivist, verifier]
fix_hats: [classifier, closer, archivist, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: report
    output: project-dashboard
  - stage: track
    discovery: status-report
  - stage: charter
    discovery: project-charter
outputs:
  - discovery: retrospective
    hat: archivist
  - discovery: lessons-learned
    hat: archivist
---

# Close

Formally close the project: confirm deliverable acceptance against the charter, transfer ownership of any ongoing surfaces, resolve or defer open items, run the retrospective, and archive documentation so future projects can learn from this one. Close is the last contract — anything not captured here is lost institutional knowledge.

## Scope

Deliverable acceptance, ownership transfer, open-item disposition, the retrospective, and the archive. Close decides *whether the project is done, who owns what's left, and what was learned* — not what was promised (charter) or how state was tracked and reported (track, report). Units are closeout surfaces.

## What to do

- Verify each charter deliverable against its acceptance criteria and obtain formal sponsor sign-off.
- Disposition every open item — assigned to an owner with a date, or formally deferred with a stated rationale.
- Run the retrospective and capture lessons learned, categorized as process, technical, or organizational.
- Organize the documentation so a future project can actually retrieve and learn from it.

## What NOT to do

- Don't accept a deliverable that doesn't meet its charter criteria, or sign off with criteria unproven.
- Don't reopen planning, tracking, or reporting; close accepts the work, it doesn't redo it.
- Don't leave an open item without an owner and a date, or defer one without rationale.
- Don't record generic lessons ("communicate better") instead of project-specific, transferable ones.
