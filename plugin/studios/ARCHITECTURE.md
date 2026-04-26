---
title: H·AI·K·U Studio Architecture — Boundaries, Lifecycle, and Hat Patterns
audience: studio authors, plugin maintainers, reviewers
status: canonical
---

# H·AI·K·U Studio Architecture

This document is the canonical reference for how studios, stages, units, hats, and feedback fit together. Every studio under `plugin/studios/` MUST conform to these rules. Every reviewer of an existing studio change MUST check the change against this doc.

If implementation drifts from this document, **the document is right** unless an explicit RFC supersedes it.

## 1. Hard boundaries

### 1.1 Frontmatter is FSM-only

Frontmatter on FSM-managed files (`unit-NN-*.md`, `FB-NN-*.md`, intent.md, state.json, iteration.json) is reserved for the FSM. Agents MAY write frontmatter when authoring a file (e.g., the elaborator drafts a unit with `depends_on:` and `inputs:`), but agents MUST NOT **interpret** frontmatter for any mechanical purpose.

Concretely:
- Reviewer hats do not grep `depends_on:` to detect DAG inversions. The FSM rejects bad DAG writes at the source.
- Verifier hats do not validate frontmatter schema. The FSM validates schema at every write.
- Fixer hats do not read another unit's frontmatter to plan a change. They read body content.

The single exception is the FSM itself (orchestrator code, MCP tool internals). FSM internals MAY read FM freely. No agent-callable MCP tool exposes FM to the agent.

### 1.2 The FSM owns CRUDL on units and feedback

All Create/Read/Update/Delete/List operations on `units/*.md` and `feedback/*.md` go through MCP tools. Generic file Read/Write/Edit on these paths is denied at the hook layer.

| Operation | Unit tool | Feedback tool |
|---|---|---|
| Create / full rewrite | `haiku_unit_write` | `haiku_feedback_write` |
| Read (body + title only) | `haiku_unit_read` | `haiku_feedback_read` |
| Update field | `haiku_unit_set` | `haiku_feedback_update` |
| Delete (pending only) | `haiku_unit_delete` | `haiku_feedback_delete` |
| List | `haiku_unit_list` | `haiku_feedback_list` |

`haiku_unit_get` (which currently exposes FM) becomes FSM-internal only. Agent-callable reads return body + title; FM stays inside the FSM.

### 1.3 Lifecycle and immutability

Units (and feedback files) move forward only:

```
pending → active → completed
```

There are no reverse transitions. No `unwind`, no `reset`, no `revisit_unit`. Once a unit becomes active or completed, the work it informed cannot be unwound.

| Status | Mutable? | Notes |
|---|---|---|
| pending | yes — body, FM (via `_set`/`_write`), delete via `_delete` | Pre-execute review is the LAST opportunity to fix |
| active | no — locked except for FSM-driven hat progression | Hat output gets appended via FSM-controlled flows; the unit's spec itself does not change |
| completed | no — fully immutable | New work that addresses defects becomes NEW pending units in the next iteration |

**Stage revisit creates new pending units; it never modifies completed units.** If a closed FB diagnoses a defect in a completed unit, the next elaborate iteration creates a corrective unit (or a follow-up unit) — it does not edit the original. This is why front-loading review (verifier hats + pre-execute review) matters.

## 2. Hat sequence pattern: plan → do → verify

Every stage's `hats:` list MUST follow `plan → do → verify`, in that order, as the leading three roles. Additional hats (e.g., adversarial loops) MAY follow but never precede.

```yaml
hats: [planner, doer, verifier]                          # minimum
hats: [planner, doer, verifier, red-team, blue-team]     # plan-do-verify + adversarial
```

### 2.1 Plan role

Reads the stage inputs (decisions, knowledge, prior-stage outputs) and produces an internal plan or a structured spec to guide the do role. May be named: `researcher`, `analyst`, `planner`, `strategist`, `designer`, `architect`, `threat-modeler`, etc.

### 2.2 Do role

Executes the plan. Produces the artifact(s) the stage is responsible for. May be named: `elaborator`, `builder`, `writer`, `engineer`, `creator`, `drafter`, etc.

### 2.3 Verify role

The terminal hat. Validates the do role's output against the stage's body-level quality rules. Calls `haiku_unit_advance_hat` (success) or `haiku_unit_reject_hat` (failure).

The verify role's mandate is **body-only**. It does not read frontmatter for mechanical checks. Examples of legitimate verify-role rules:
- Are all sections of the unit spec populated with substantive content?
- Does the body contradict any open Decision in the intent's decision register?
- Is the body internally consistent (does it cite sibling units' content correctly)?
- Does the body answer the unit's own open questions?

Examples of illegitimate verify-role rules (these are FSM responsibilities):
- ❌ Does `depends_on:` resolve to existing units?
- ❌ Is the YAML frontmatter schema valid?
- ❌ Does the unit's `inputs:` match the prior stage's `outputs:`?

The verify hat may be named `verifier`, `reviewer`, `validator`, `assessor`, `auditor`, `qa`, `tester`, `critic`, `fact-checker`, or any equivalent that makes the role clear in the studio's vocabulary.

### 2.4 Adversarial loops

Studios with adversarial workflows (security-assessment, software/security, etc.) MAY include adversarial hats AFTER the plan-do-verify triplet. The adversarial hats are exempt from the verify-role rules but the plan-do-verify front loop is mandatory.

```yaml
# software/security
hats: [threat-modeler, security-engineer, security-reviewer, red-team, blue-team, security-final-reviewer]
#       ↑ plan          ↑ do                ↑ verify         ↑ adversarial loop  ↑ adversarial verify
```

## 3. Fix-loop pattern

Findings (FBs) raised by adversarial reviewers are addressed by the fix-loop. The fix-loop is mechanically identical to unit execution, with the FB file as the work artifact.

### 3.1 FB-as-unit

When a fix-loop dispatches against an FB:
- The FB file IS the unit. The fixer hats read it, edit it, and complete it via `haiku_unit_advance_hat` against the FB.
- Fixer hats MUST NOT edit unit files. The flagged unit is read-only context (read via `haiku_unit_read`); the fixer's deliverable is the FB body populated with diagnosis, root cause, proposed action.
- The same plan-do-verify pattern applies. The stage's `fix_hats:` list MUST contain at least three hats forming the loop. The terminal hat validates the FB body and calls `haiku_unit_advance_hat` against the FB.
- FSM lifecycle enforcement is identical: FBs go pending → active → completed.

### 3.2 Closed FBs become input, not patches

A "completed" FB means its diagnosis is well-formed. It does NOT mean the underlying defect is patched. Patching happens during the next iteration of the upstream stage:
- The FSM rolls the stage back to elaborate (or whichever phase produces the artifact type).
- Closed FBs are inlined into the elaborator's dispatch as additional context.
- The elaborator authors NEW pending units that address the findings.
- Existing completed units are not modified. (See §1.3 — forward-only.)

This is why front-loading matters. By the time a defect surfaces at the gate, the original units that contain it are permanent. The corrective work happens above them.

## 4. Hook boundary

The PreToolUse hook denies generic file Read/Write/Edit on FSM-managed paths. The hook redirects the agent at the appropriate MCP tool.

Denied paths (Read/Write/Edit):
- `.haiku/intents/*/stages/*/units/*.md`
- `.haiku/intents/*/stages/*/feedback/*.md`
- `.haiku/intents/*/intent.md`
- `.haiku/intents/*/stages/*/state.json`

Denial message format: `"This file is FSM-managed. Use \`haiku_unit_read { intent: \"<slug>\", stage: \"<stage>\", unit: \"<unit>\" }\` instead."`

Bash commands referencing these paths are **soft-warned** (logged, not blocked). Routine MCP usage is the path of least resistance; persistent Bash bypass is anomalous and shows up in audit telemetry.

## 5. Studio-author checklist

When adding or modifying a stage:

- [ ] `hats:` list has at least 3 entries
- [ ] First hat is plan-class, second is do-class, third is verify-class
- [ ] Verify hat's mandate is body-only (no FM interpretation)
- [ ] If `fix_hats:` is set, it also has at least 3 entries forming plan-do-verify
- [ ] Adversarial hats (if any) come AFTER the plan-do-verify triplet
- [ ] Hat mandate files exist for every named hat (`hats/{name}.md`)
- [ ] No mandate file references `depends_on:`, `inputs:`, `outputs:`, `status:`, or any other FM field as something the agent should read or interpret

When adding or modifying an FSM tool:

- [ ] Writes that affect frontmatter run the appropriate validators
- [ ] Lifecycle enforcement (pending/active/completed) is checked
- [ ] Read tools return body + title only unless the caller is FSM-internal
- [ ] Tool errors name the rule that fired ("status is `active`; units become immutable once started")

## 6. Source of truth

This document supersedes any conflicting guidance in:
- `website/content/papers/haiku-method.md`
- Per-studio `STUDIO.md` files
- Per-stage `STAGE.md` files
- Hat mandate files (`hats/*.md`)

When a discrepancy is found, fix the downstream artifact, not this document — unless an explicit revision proposal is approved that updates this file first.
