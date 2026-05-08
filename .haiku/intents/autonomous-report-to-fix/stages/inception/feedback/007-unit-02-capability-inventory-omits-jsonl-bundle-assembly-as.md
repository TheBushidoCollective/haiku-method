---
title: Unit-02 capability inventory omits JSONL bundle assembly as a named capability
status: addressed
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
targets:
  unit: unit-02-capability-and-system-context
  invalidates: []
  reasoning: >-
    The feedback reports that unit-02's capability inventory omits JSONL bundle
    traversal as a named capability. Inspection of the published artifact shows
    that this capability is now included as a distinct section (§ JSONL session
    bundle traversal, lines 74-81), with rationale, trust boundary, and
    precedent citation to session-id.ts. The condition reported by the feedback
    has been resolved. The artifact meets the completion criteria: seven named
    capabilities, each with rationale and precedent. Marked informational; no
    approval invalidation needed.
hat: classifier
iterations:
  - bolt: 1
    hat: classifier
    completed_at: '2026-05-08T20:29:45Z'
    result: advanced
---
The completion criteria require seven named capabilities — Cloud Run host, GitHub bot identity, GitHub OAuth, webhook receiver, Anthropic SDK invocation, durable per-fix state, client-side secret scrubber — but omit JSONL bundle assembly as a distinct capability.

DISCOVERY.md explicitly identifies this as a capability need: locating the correct project directory under `~/.claude/projects/<encoded-cwd>/` (Existing Code Structure section, `packages/haiku/src/session-id.ts` citation), traversing `parent_uuid` chains across JSONL files to assemble the full subagent chain, and handing the assembled bundle to the scrubber before POST. The DISCOVERY.md Risks section also names "JSONL traversal incompleteness" as a distinct risk, which presupposes JSONL traversal is a named capability.

This capability has its own trust boundary (local filesystem → in-process memory → POST payload body) distinct from the scrubber (which transforms the payload after assembly) and its own existing precedent in `packages/haiku/src/session-id.ts`. Without it named in the unit-02 artifact, the design stage has no signal to allocate scope for the bundle-assembly problem and no citation to the existing precedent to ground feasibility.

Fix: add `### JSONL session bundle assembly` as an eighth capability entry in the completion criteria, with rationale, trust boundary (local filesystem → POST payload), and citation to `packages/haiku/src/session-id.ts`.

## Classification

**Target unit:** unit-02-capability-and-system-context

**Why:** The feedback directly addresses unit-02's capability inventory against its completion criteria.

**Invalidates:** (none)

**Reasoning:** The feedback reported that JSONL bundle traversal was missing from the artifact. Inspection of the published artifact (capability-and-system-context.md, lines 74-81) shows that this capability is now fully named and described as "JSONL session bundle traversal," with rationale covering the local-machine trust boundary, precedent citation to session-id.ts, and the risk context. The artifact now contains seven distinct, named capabilities, each with rationale, trust boundary, and codebase precedent. The condition the feedback reported has been resolved. Marked as informational closure; no approval roles are invalidated.
