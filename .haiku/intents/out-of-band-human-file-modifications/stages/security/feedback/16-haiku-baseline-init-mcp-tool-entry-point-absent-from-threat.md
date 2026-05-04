---
title: haiku_baseline_init MCP tool entry point absent from threat model
status: addressed
origin: adversarial-review
author: threat-coverage
author_type: agent
created_at: '2026-05-03T11:04:05Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-03T11:04:05Z'
resolution: inline_fix
replies: []
hat: security-engineer
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T12:18:17Z'
    result: advanced
---
## Finding

`packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts` is a NEW operator-callable MCP tool registered at `packages/haiku/src/tools/orchestrator/index.ts:13,26`. Its modes (`establish-all`, `establish-paths`) write directly to the integrity-critical `baseline.json` asset (the same asset V-11 names as `Critical` integrity in the unit-03 threat model §5.1, and the same asset whose silent re-establish is what V-11 closes).

THREAT-MODEL.md does not enumerate this tool anywhere:
- Not in §3 STRIDE catalog (no row mapping `haiku_baseline_init` to a threat or feature)
- Not in §4 per-feature attack-surface map (no entry-point listing it)
- Not in §5 (`haiku_classify_drift` gets its own MCP-tool entry-point treatment but `haiku_baseline_init` does not)
- Not in §7 threat-to-control matrix

## Why this is a threat-coverage gap

The mandate requires the threat model to "verify that threat model covers all entry points (APIs, webhooks, file uploads, user input)". MCP tools that mutate integrity-critical state ARE entry points. The unit-03 sub-model carefully reasoned about V-11 closing the *gate-side* silent-establish path — but the tool that explicitly writes baselines is itself a write surface that needs:

- STRIDE row: spoofing (who's allowed to call it? `operator-callable` is a property claim, not an enforcement mechanism; what stops a hostile/buggy agent from calling it?), tampering (what input validation prevents `establish-paths` from re-baselining attacker-chosen content into the trusted snapshot?), elevation of privilege (does this tool require any auth boundary the way `/haiku:repair --confirm-baseline-reset --diff-shown` requires operator confirmation?).
- Trust-boundary placement: in local mode, the agent has full MCP-tool reach by definition — what prevents the agent from invoking `haiku_baseline_init { mode: "establish-paths", paths: [...attacker-positioned-paths...] }` as a one-step laundry against everything V-11 closed?
- Audit-log integration: does each `haiku_baseline_init` invocation produce a `baseline_corruption_event` action-log entry the way the gate-side path does, or does it bypass the v11 detection surface?

## Required fix

Add `haiku_baseline_init` to:
1. §3 STRIDE matrix — at minimum a Tampering row (T-N) on `silent-filesystem-drop-detection.feature` covering "operator MCP tool re-baselines attacker-controlled content"
2. §5 — extend the `haiku_classify_drift as its own MCP-tool entry point` paragraph to also call out `haiku_baseline_init` (the two are sibling MCP-tool entry points to the same drift subsystem)
3. §7 threat-to-control matrix — name the controls that protect this tool (input validation for `paths`, agent-vs-operator authorization, action-log entry shape)

If the conclusion is "no controls beyond `tracked surface allow-list` and `baseline.json sha256` validation are needed because this tool runs only in operator-trusted contexts," that conclusion needs to be stated and the trust-boundary justification recorded — exactly the same way §1.4 records the four JWT-trust assumptions.

## Files

- `packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts` (the tool)
- `packages/haiku/src/tools/orchestrator/index.ts:13,26` (registration)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md` (the gap)
