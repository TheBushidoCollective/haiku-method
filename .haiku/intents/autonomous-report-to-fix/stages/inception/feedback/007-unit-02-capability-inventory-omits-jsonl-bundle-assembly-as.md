---
title: Unit-02 capability inventory omits JSONL bundle assembly as a named capability
status: pending
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-05-08T20:28:10Z'
iteration: 0
visit: 0
source_ref: spec
closed_by: null
bolt: 0
triaged_at: '2026-05-08T20:28:10Z'
resolution: null
replies: []
inline_anchor:
  selected_text: >-
    A `## Capability inventory` section with at least six named capabilities
    (Cloud Run host, GitHub bot identity, GitHub OAuth for users, GitHub webhook
    receiver, Anthropic SDK invocation, durable per-fix state, client-side
    secret scrubber).
  paragraph: 5
  location: 'Unit-02: Capability needs and system context — Completion criteria'
---

The completion criteria require seven named capabilities — Cloud Run host, GitHub bot identity, GitHub OAuth, webhook receiver, Anthropic SDK invocation, durable per-fix state, client-side secret scrubber — but omit JSONL bundle assembly as a distinct capability.

DISCOVERY.md explicitly identifies this as a capability need: locating the correct project directory under `~/.claude/projects/<encoded-cwd>/` (Existing Code Structure section, `packages/haiku/src/session-id.ts` citation), traversing `parent_uuid` chains across JSONL files to assemble the full subagent chain, and handing the assembled bundle to the scrubber before POST. The DISCOVERY.md Risks section also names "JSONL traversal incompleteness" as a distinct risk, which presupposes JSONL traversal is a named capability.

This capability has its own trust boundary (local filesystem → in-process memory → POST payload body) distinct from the scrubber (which transforms the payload after assembly) and its own existing precedent in `packages/haiku/src/session-id.ts`. Without it named in the unit-02 artifact, the design stage has no signal to allocate scope for the bundle-assembly problem and no citation to the existing precedent to ground feasibility.

Fix: add `### JSONL session bundle assembly` as an eighth capability entry in the completion criteria, with rationale, trust boundary (local filesystem → POST payload), and citation to `packages/haiku/src/session-id.ts`.
