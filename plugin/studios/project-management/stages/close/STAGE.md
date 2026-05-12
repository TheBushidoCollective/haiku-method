---
name: close
description: Conduct retrospective, capture lessons learned, and handoff
hats: [closer, archivist, verifier]
fix_hats: [classifier, closer, feedback-assessor]
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

## Per-unit baton

Each unit is a closeout surface — a deliverable acceptance, an ownership transfer, an open-item disposition, a lesson learned, or an archival step. The three hats walk it in `plan → do → verify` order:

- **`closer`** (plan) verifies each charter deliverable against acceptance criteria, obtains formal sponsor sign-off, and dispositions every open item (assigned to an owner with a date, or formally deferred with rationale)
- **`archivist`** (do) facilitates the retrospective, captures lessons learned categorized as process / technical / organizational, organizes documentation for retrievability, and writes the project-summary record
- **`verifier`** (verify) checks the body for formal acceptance evidence, owner-and-date on every open item, project-specific (not generic) lessons, and accessible archive structure — advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The close stage consumes `report/discovery/project-dashboard`, `track/discovery/status-report`, and `charter/discovery/project-charter`. Its outputs are `RETROSPECTIVE.md` (the team's recorded reflection) and `LESSONS-LEARNED.md` (the cross-project transferable insights).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, closer, feedback-assessor]` dispatches per finding. The gate is `ask` — sponsor and team review of closeout artifacts before formal sign-off. Project overlays may add organization-specific lessons-learned repositories, archive-platform integration, or formal-closure workflow integration with a specific PM tool without modifying the plugin defaults.
