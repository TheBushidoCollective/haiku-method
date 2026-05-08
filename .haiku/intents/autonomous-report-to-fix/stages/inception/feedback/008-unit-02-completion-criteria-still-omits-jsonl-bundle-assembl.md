---
title: >-
  Unit-02 completion criteria still omits JSONL bundle assembly from required
  capability enumeration
status: pending
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-05-08T22:07:06Z'
iteration: 0
visit: 0
source_ref: spec
closed_by: null
bolt: 0
triaged_at: '2026-05-08T22:07:06Z'
resolution: null
replies: []
inline_anchor:
  selected_text: >-
    at least six named capabilities (Cloud Run host, GitHub bot identity, GitHub
    OAuth for users, GitHub webhook receiver, Anthropic SDK invocation, durable
    per-fix state, client-side secret scrubber)
  paragraph: 5
  location: 'Unit-02: Capability inventory completion criterion'
---

FB-007 was filed because the unit-02 artifact omitted JSONL bundle assembly as a named capability, and was marked "addressed" — meaning the artifact was corrected. But the unit-02 spec body (the completion criteria) was never updated to include JSONL bundle assembly in its parenthetical enumeration of required capabilities. The current spec reads: "at least six named capabilities (Cloud Run host, GitHub bot identity, GitHub OAuth for users, GitHub webhook receiver, Anthropic SDK invocation, durable per-fix state, client-side secret scrubber)." JSONL bundle assembly / subagent-chain traversal is absent from this list.

The minimum gate is ≥6, so a researcher hat could produce an artifact that passes the gate without including JSONL assembly — especially since the parenthetical is what hats read to understand what "six" means. The spec is the guidance artifact; if it doesn't name JSONL bundle assembly, future runs or re-elaborations will omit it again.

**Required fix:** Add "JSONL bundle assembly (client-side collection and traversal of session JSONL files reachable via `parent_uuid`)" to the parenthetical enumeration in the `## Capability inventory` completion criterion, and raise the minimum count to ≥7 (or ≥8 if the artifact already covers eight capabilities).
