# Knowledge Artifact — unit-01-discovery-document

This artifact records the completion of the discovery-document research unit for the `out-of-band-human-file-modifications` intent, inception stage.

## Primary Output

The discovery document was produced at:
`.haiku/intents/out-of-band-human-file-modifications/knowledge/DISCOVERY.md`

## Summary of Research Findings

The discovery document captures the full problem space for sanctioned out-of-band human writes in H·AI·K·U. Key findings:

**Business context:** Three concrete motivating scenarios (designer layout replacement, PO small-edit-then-extend, knowledge upload) all share a root cause: the framework has no detection layer for human-authored changes outside the MCP tool path. The vision is automatic detection on the next workflow tick, followed by agent-driven classification (ignore / fold in / surface-as-feedback / trigger revisit).

**Competitive landscape:** Seven products surveyed (Cursor, Aider, GitHub Copilot Workspace, Devin, Figma + Code Connect, Notion AI / Coda AI, Cody / Continue). No competitor combines a structured multi-stage workflow with first-class out-of-band human write detection and agent-driven classification. The `manual_change_assessment` action is a genuine differentiator.

**Capability needs:** Seven high-level dependencies identified — per-stage SHA baseline storage, per-tick diff detection, diff-classification capability, sanctioned upload UI, sanctioned agent-writes-on-behalf-of-human MCP tool, diff presentation (including binary-degraded mode), and rejection/acknowledgment record.

**Risks:** Eight distinct failure modes catalogued — false-positive storm, classification loop, eventual-consistency surprise, mid-bolt concurrency, classification quality / trust erosion, non-tracked file blindness, binary-diff blindness, and hook-bypass liability.

**Open questions:** Nine questions framed for the design stage to answer, covering tracked surface boundary, ambiguous-diff behavior, SPA upload stage scoping, workflow-managed-file edge case, autopilot UX, revisit integration, SPA-as-event vs. filesystem-write, human-vs-agent write distinction at storage layer, and partial-write / temp-file stability.

**Overlap:** `remote-review-spa` and `cowork-mcp-apps-integration` branches have in-flight work on `packages/haiku/review-app/` (direct overlap with upload UI); `archivable-intents` and `cascading-model-selection` have broad `packages/haiku/src/` changes including `orchestrator.ts` and `state-tools.ts` (coordination needed at execution for hook and orchestrator additions).

## Completion Criteria Met

All nine completion criteria verified against the discovery document at the time this artifact was written. The document is 27,752 bytes of substantive prose, contains per-product competitive analysis with explicit "what they do well" and "gap" pairs, names all required user roles and motivating scenarios, lists ≥7 risks, ≥9 open questions, ≥7 capability needs, includes cross-cutting boundary callouts, contains no implementation-specific details (no entity field names, no `packages/haiku/src/` file paths, no API shapes, no shell commands), and ends with an updated overlap awareness section.
