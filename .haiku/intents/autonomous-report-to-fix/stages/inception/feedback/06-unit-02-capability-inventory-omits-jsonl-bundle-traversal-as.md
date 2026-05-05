---
title: >-
  Unit-02 capability inventory omits JSONL bundle traversal as a named
  load-bearing capability
status: pending
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-05-05T23:17:22Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-05T23:17:22Z'
resolution: null
replies: []
---

## Mandate check

The completeness mandate requires: "The agent MUST verify that high-level capability needs are named." It also requires that unit topics together cover the intent's scope with no obvious gaps in the problem space.

## What the artifact contains

`stages/inception/artifacts/capability-and-system-context.md` enumerates seven capabilities:

1. Cloud Run host
2. GitHub bot identity
3. GitHub OAuth for users
4. GitHub webhook receiver
5. Anthropic SDK invocation
6. Durable per-fix state
7. Client-side secret scrubber

## What is missing

**JSONL session bundle traversal** — the capability that locates the current session's JSONL files under `~/.claude/projects/<encoded-cwd>/`, traverses the `parent_uuid` chain to identify all linked subagent JSONL files, and assembles them into the session bundle — is not named as a capability in unit-02.

This capability is load-bearing:

- The discovery doc explicitly calls it out (DISCOVERY.md § Existing Code Structure, line 117: `packages/haiku/src/session-id.ts` — "session ID generation and encoding helpers; relevant for locating the correct project directory") and (DISCOVERY.md § Risks, line 96: "JSONL subagent chain traversal correctness").
- Unit-05 identifies JSONL traversal incompleteness as a named risk (Risk #5: "JSONL Traversal Incompleteness," severity: med). A named risk about a capability that isn't itself named in the capability inventory creates a gap: downstream stages (development, security) can see the risk but have no canonical capability name to design against.
- Unit-03 (affected surfaces, Step 2) describes what this capability does operationally ("traverses the `parent_uuid` chain to gather the full subagent tree") but does so as a surface-description aside, not as a named capability with a trust boundary, rationale, and precedent.

The omission means downstream stages lack a canonical name for this capability, making it harder for them to reason about its trust boundary (user machine only — the traversal happens entirely client-side, before any data leaves the machine) and its precedent (`packages/haiku/src/session-id.ts`).

## Gap severity

The capability is mentioned in passing in unit-03 and risk-assessed in unit-05, but its absence from unit-02's capability inventory is a problem-space gap: the primary artifact for "what the loop must be able to do" does not name a capability that is both load-bearing and failure-prone. This is exactly the kind of gap the completeness mandate exists to catch — not a design detail, but a missing problem-space acknowledgment.

## Required fix

Add a `### JSONL session bundle traversal` entry to unit-02's capability inventory (`stages/inception/artifacts/capability-and-system-context.md`) containing:

- **Rationale:** The plugin must locate and assemble the complete session context — all JSONL files reachable from the current session ID via the `parent_uuid` chain — before scrubbing and POST. An incomplete traversal degrades the diagnostic signal available to the fix agent.
- **Trust boundary:** User machine only. The traversal reads files from the local filesystem (`~/.claude/projects/<encoded-cwd>/`); no external service is involved. This is the only capability that runs entirely within the user's trust domain before the bundle crosses to Cloud Run.
- **Precedent:** `packages/haiku/src/session-id.ts` (session ID generation and encoding helpers; relevant for locating the correct project directory, as noted in DISCOVERY.md § Existing Code Structure line 117).
