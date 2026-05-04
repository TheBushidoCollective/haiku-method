---
title: Discovery document
model: sonnet
inputs:
  - intent.md
  - knowledge/CONVERSATION-CONTEXT.md
outputs:
  - .haiku/intents/out-of-band-human-file-modifications/knowledge/DISCOVERY.md
status: completed
bolt: 1
hat: verifier
started_at: '2026-04-28T14:12:36Z'
hat_started_at: '2026-04-28T14:17:10Z'
iterations:
  - hat: researcher
    started_at: '2026-04-28T14:12:36Z'
    completed_at: '2026-04-28T14:15:16Z'
    result: advance
  - hat: distiller
    started_at: '2026-04-28T14:15:16Z'
    completed_at: '2026-04-28T14:17:10Z'
    result: advance
  - hat: verifier
    started_at: '2026-04-28T14:17:10Z'
    completed_at: '2026-04-28T14:18:44Z'
    result: advance
completed_at: '2026-04-28T14:18:44Z'
---
# Discovery Document

Review the DISCOVERY.md knowledge artifact at `.haiku/intents/out-of-band-human-file-modifications/knowledge/DISCOVERY.md` (initial draft written by the discovery fan-out subagent) and verify it meets the completion criteria below. If any criterion is unmet, produce the missing sections or extend the artifact until every criterion is satisfied. This unit does NOT regenerate the artifact from scratch — it starts from what exists and brings it to the required bar.

The discovery captures problem space, business context, competitive landscape, considerations & risks, and UI impact at the level the design stage will consume — WHAT and WHY, not HOW.

## Scope

The DISCOVERY.md must cover:

- Business context — feature goal & vision, origin, success criteria (functional + outcome-based, observable by users)
- Competitive landscape — at least Cursor, Aider, GitHub Copilot Workspace, Devin, Figma+Code Connect, Notion/Coda AI, IDE agents (Cody/Continue), each with a one-paragraph approach summary and a real URL
- Considerations & risks — strategic considerations (compliance, rollout, behavior change for existing intents), capability needs (per-stage SHA baseline storage, per-tick diff detection, classification capability, sanctioned upload UI, sanctioned "agent writes on behalf of human" tool, diff presentation, rejection/acknowledgment record), open questions framed for the design stage to answer, risks at the strategic/product level
- UI impact — affected surfaces (browse SPA upload, knowledge upload, drift assessment view, chat, docs)
- Overlap awareness — scan of active haiku branches for file-level overlap

The artifact may NOT contain entity field names, API endpoints, file paths within `packages/haiku/src/`, code-archaeology summaries, performance budgets in implementation terms, or any specific shell commands. Those belong in design / development.

## Completion Criteria

- DISCOVERY.md exists at `.haiku/intents/out-of-band-human-file-modifications/knowledge/DISCOVERY.md` and is at least 8KB of substantive prose
- Business context section names primary user roles affected (designer, product owner, knowledge-uploading user); captures by name the three motivating scenarios (designer replaces a stage output file, product owner makes a small edit then asks AI to extend, user uploads knowledge into elaborate); and states ≥2 observable outcome-based success criteria framed in user-observable terms (e.g., "a designer who replaces a stage output sees the change acknowledged on the next workflow tick rather than silently regenerated") — not implementation milestones
- Competitive landscape names ≥6 specific products with a real URL each, a one-paragraph differentiation summary, and an explicit "what they do well" + "gap" pair
- Risks section lists ≥7 distinct failure modes — false-positive storm, classification loop, eventual-consistency surprise, mid-bolt concurrency, classification quality / trust erosion, non-tracked files, binary-diff blindness, hook bypass becoming a liability — each with a one-paragraph description
- Open questions section has ≥7 questions, each framed for design to answer, none paper over scope gaps with prose
- Capability needs section names ≥6 high-level dependencies at the capability level (not implementation level), e.g. "per-stage SHA baseline storage" not "a JSON file at .haiku/intents/{slug}/baselines.json"
- Cross-cutting boundary callouts to sibling artifacts (workflow engine, security/hooks) are present and explicitly do NOT author substance there
- Document distinguishes problem space from any specific solution: no entity field names, no file paths under `packages/haiku/src/`, no API method shapes, no shell commands
- Document ends with an Overlap Awareness section reporting the result of the active-branch scan
