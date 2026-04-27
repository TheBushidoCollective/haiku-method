---
title: H·AI·K·U Studio Architecture — Boundaries, Lifecycle, and Hat Patterns
audience: studio authors, plugin maintainers, reviewers
status: canonical
---

# H·AI·K·U Studio Architecture

Canonical reference for how studios, stages, units, hats, and feedback fit together. Every studio under `plugin/studios/` MUST conform. Every reviewer of a studio change MUST check the change against this doc.

**Conflict resolution:** when this document and the implementation disagree, the default presumption is that this document captures the intended target state and the implementation should be brought into line — UNLESS one of the following applies:
- The conflict is a documentation bug (this doc misrepresents what was actually agreed; fix the doc).
- A specific implementation choice has shipped and is in production use; revising to match this doc would break working behavior. In that case, file a revision proposal that updates this doc first, then change the implementation in a follow-up.

This is consistent with `CLAUDE.md` and `.claude/rules/architecture-prototype-sync.md`: the canonical source of truth depends on what's drifting from what. For runtime visualizations (the prototype), the orchestrator code is canonical when they conflict. For structural rules across studios/stages/hats/feedback, this document is canonical because there's no single implementation file that fully encodes them.

## 1. Hard boundaries

### 1.1 Frontmatter is workflow engine-only

Frontmatter on workflow-managed files (`unit-NN-*.md`, `FB-NN-*.md`, `intent.md`, `state.json`, iteration files) is reserved for the workflow engine. Agents MAY write frontmatter when authoring a file (the elaborator drafts a unit with declared inputs/outputs); agents MUST NOT **interpret** frontmatter for any mechanical purpose.

- Reviewer hats do not grep `depends_on:` to detect DAG inversions. The workflow engine rejects bad DAG writes at the source.
- Verifier hats do not validate frontmatter schema. The workflow engine validates schema at every write.
- Fixer hats do not read another unit's frontmatter to plan a change. They read body content.

The single exception is the workflow engine itself (orchestrator code, MCP tool internals). workflow engine internals MAY read FM freely. **No agent-callable MCP tool exposes FM to the agent.**

### 1.2 The workflow engine owns CRUDL on units and feedback

All Create/Read/Update/Delete/List operations on `units/*.md` and `feedback/*.md` go through MCP tools. Generic file Read/Write/Edit on these paths is denied at the hook layer.

| Operation | Unit tool | Feedback tool |
|---|---|---|
| Create / full rewrite | `haiku_unit_write` | `haiku_feedback_write` |
| Read (body + title only) | `haiku_unit_read` | `haiku_feedback_read` |
| Update field | `haiku_unit_set` | `haiku_feedback_update` |
| Delete (pending only) | `haiku_unit_delete` | `haiku_feedback_delete` |
| List | `haiku_unit_list` | `haiku_feedback_list` |

`haiku_unit_get` (which exposes FM) becomes workflow engine-internal only. Agent-callable reads return body + title; FM stays inside the workflow engine.

### 1.3 Lifecycle is forward-only

Units (and feedback files) move forward only:

```
pending → active → completed
```

There are no reverse transitions. No `unwind`, no `reset`, no `revisit_unit`. Once a unit is active or completed, the work it informed cannot be unwound.

| Status | Mutable? | Notes |
|---|---|---|
| pending | yes — body, FM (via `_set`/`_write`), delete via `_delete` | Pre-execute review is the LAST chance to fix |
| active | no — locked except for workflow-driven hat progression | Spec is frozen; hat outputs append via workflow engine-controlled flows |
| completed | no — fully immutable | New work that addresses defects becomes NEW pending units in the next iteration |

**Stage revisit creates new pending units; it never modifies completed units.** If a closed FB diagnoses a defect in a completed unit, the next elaborate iteration creates a corrective unit (or a follow-up unit) — it does not edit the original. Front-loading review (verifier hats + pre-execute review) is therefore critical.

## 2. Stage anatomy

### 2.1 Phases (workflow-driven)

Every stage has the same workflow engine lifecycle:

| Phase | Purpose | Who acts |
|---|---|---|
| **elaborate** | Authors the unit set for THIS stage | The elaborate-phase agent (one per stage; named per studio) |
| **execute** | Each unit runs through the per-unit hat chain | Per-unit subagents, one hat at a time |
| **review** | Adversarial reviewers inspect completed units | Stage-level review agents |
| **gate** | Approval to advance | Human (`ask`) or external (`external`) or auto (`auto`) |

**Critical:** units are created **only** in the elaborate phase of THIS stage. Execution NEVER creates units. A different stage NEVER creates units for this stage.

Each stage is responsible for its own unit set. `inception` does not pre-author units for `development`. `development`'s elaborate phase authors `development`'s units, drawing on `inception`'s knowledge artifacts as inputs.

### 2.2 Units are stage-appropriate, not universal

The shape of a "unit" depends on the stage's role:

| Stage role | What a unit IS | Examples |
|---|---|---|
| **Research / distillation** (inception, market-research, discovery) | A knowledge topic to investigate | "Competitive landscape", "User persona", "Technical feasibility" |
| **Design / synthesis** (design, prototype, options) | A design component or option set | "Auth flow design", "Navigation pattern", "Data model option A" |
| **Build / execution** (development, firmware, manufacturing) | A discrete piece of work to execute | "Implement /api/users", "Wire up auth middleware", "Ship database migration" |
| **Validation / certification** (validation, certify) | A verification surface to test | "API contract test pass", "FCC pre-cert sweep", "Penetration test of auth boundary" |
| **Operational** (deployment, cutover, launch) | An operational step to perform | "Run blue-green deploy", "Migrate production data", "Flip DNS" |
| **Adversarial / security** (software/security, security-assessment) | An attack surface or threat boundary | "Auth flow surface", "Data layer surface", "Public API surface" |

A studio author defines what a unit IS for each of their stages by writing the stage's elaborate-phase contract.

### 2.3 The rally-race test

Hats form a **rally race**: each hat receives a baton from the previous hat and hands a more-evolved baton to the next. **If the baton between two hats does not matter, they are not a hat sequence — they are a list of activities and need a different structure.**

Failure modes:
- Activities that run independently and don't pass anything meaningful between them are stage-level activities, not hats. Express them as separate stage phases or as parallel review-agents, not as `hats:`.
- Activities where hat N+1 doesn't actually consume hat N's output are misnamed hats; restructure or rename.

## 3. Hat sequence pattern: plan → do → verify

Every stage's `hats:` list MUST follow `plan → do → verify`, in that order, as the leading three roles. Additional hats (e.g., adversarial loops) MAY follow but never precede.

```yaml
hats: [planner, doer, verifier]                           # minimum
hats: [planner, doer, verifier, red-team, blue-team]      # plan-do-verify + adversarial
```

### 3.1 Hat-name discipline (CRITICAL)

**Hat names MUST be distinct from phase names.** The prior model used `elaborator` as both a hat name and the elaborate phase, which created confusion at every layer of the architecture (this document, the orchestrator, the per-stage hats).

Reserved phase names that MUST NOT be used as hat names: `elaborate`, `execute`, `review`, `gate`. Stage-appropriate hat names instead:

| Stage role | Plan hat | Do hat | Verify hat |
|---|---|---|---|
| Research / distillation | `researcher` | `distiller`, `synthesizer` | `verifier`, `validator` |
| Design / synthesis | `designer`, `architect` | `synthesizer`, `composer` | `design-reviewer`, `verifier` |
| Build / execution | `planner`, `architect` | `builder`, `engineer`, `implementer` | `reviewer`, `verifier` |
| Validation / certification | `analyst`, `planner` | `tester`, `validator` | `auditor`, `certifier` |
| Operational | `coordinator`, `planner` | `operator`, `executor` | `verifier`, `qa` |
| Adversarial | `threat-modeler` | `red-team`, `attacker` | `blue-team`, `security-reviewer` |

### 3.2 Plan role

Reads the stage inputs (decisions, knowledge from prior stages, sibling units' outputs) and produces an internal plan or structured spec to guide the do role. **Baton handoff: plan artifact.**

### 3.3 Do role

Executes the plan. Produces the artifact(s) the unit is responsible for. **Baton handoff: the unit's body content.**

### 3.4 Verify role

Terminal hat. Validates the do role's output against the stage's body-level quality rules. Calls `haiku_unit_advance_hat` (success) or `haiku_unit_reject_hat` (failure). **Baton: validated output OR a structured rejection that names the failed criterion.**

The verify role's mandate is **body-only**. It does not read frontmatter for mechanical checks. Examples of legitimate verify-role rules:
- Are all sections of the unit body populated with substantive content?
- Does the body contradict any open Decision in the intent's decision register?
- Is the body internally consistent (does it cite sibling units' content correctly)?
- Does the body answer the unit's own open questions?

Examples of illegitimate verify-role rules (these are workflow engine responsibilities):
- ❌ Does `depends_on:` resolve to existing units?
- ❌ Is the YAML frontmatter schema valid?
- ❌ Does the unit's `inputs:` match the prior stage's `outputs:`?

### 3.5 Adversarial loops

Studios with adversarial workflows (security-assessment, software/security, etc.) MAY include adversarial hats AFTER the plan-do-verify triplet. Adversarial hats are exempt from the body-only rule but the plan-do-verify front loop is mandatory.

```yaml
# software/security — units = attack surfaces
hats: [threat-modeler, security-engineer, security-reviewer, red-team, blue-team, attack-resolver]
#       ↑ plan          ↑ do                ↑ verify         ↑ adversarial loop  ↑ adversarial verify
```

## 4. Stage roles in detail

### 4.1 Research / distillation stages (inception-class)

**Purpose:** Take the user's intent ("as a user I want to X") and turn it into a broad set of distinct knowledge artifacts. Market research, user problem, technical landscape, distilled WHY and high-level HOW. Outputs feed every downstream stage.

**Units:** Knowledge topics. Each unit corresponds to one investigable question or knowledge surface.

**Per-unit hat chain:** `researcher → distiller → verifier` (or stage-equivalent names).
- Researcher gathers raw findings on THIS topic
- Distiller turns raw findings into a structured, actionable knowledge artifact for THIS topic
- Verifier validates the artifact

**Baton:** topic shell → research notes → distilled artifact → validated artifact.

**Stage outputs:** Per-topic knowledge artifacts. **NOT** execution-unit specs for downstream stages; downstream stages create their own units in their own elaborate phase.

**Examples:** software/inception, hwdev/inception, libdev/inception, gamedev/concept, hwdev/requirements, product-strategy/discovery.

### 4.2 Design / synthesis stages

**Purpose:** Take the upstream knowledge and translate it into a designed solution. Architectural design, UX design, atomic design, API design.

**Units:** Design components or option sets. The DAG reflects the studio's design discipline (atomic design has hierarchy: atoms → molecules → organisms; software design might have layers: data → service → API).

**Per-unit hat chain:** `designer → synthesizer → verifier` (or equivalent).

**Examples:** software/design, hwdev/design, libdev/inception's API surface portion (currently bundled with inception — see §6 known issues).

### 4.3 Build / execution stages

**Purpose:** Take the designed solution and build it. Source code, hardware boards, training content, marketing assets.

**Units:** Discrete executable pieces of work. Each unit's spec includes acceptance criteria, completion criteria, executable verification (`quality_gates:`).

**Per-unit hat chain:** `planner → builder → reviewer` (or equivalent).

**This is the only stage role where execution-unit specs (with `depends_on:`, `quality_gates:`, executable verify-commands) make sense.** They're authored in build-stage's elaborate phase, NOT in upstream stages.

**Examples:** software/development, hwdev/firmware, hwdev/manufacturing, libdev/development.

### 4.4 Validation / certification stages

**Purpose:** Verify the built product against requirements / standards / contracts.

**Units:** Verification surfaces — one per testable boundary or compliance area.

**Per-unit hat chain:** `analyst → tester → certifier` (or equivalent).

**Examples:** hwdev/validation, software/security (as adversarial-loop variant), quality-assurance/certify, compliance/certify.

### 4.5 Operational stages

**Purpose:** Perform a step in deploying or operating the system.

**Units:** Operational steps. Often sequential (cutover step 1 must complete before step 2).

**Per-unit hat chain:** `coordinator → operator → verifier` (or equivalent).

**Examples:** software/operations, migration/cutover, marketing/launch, dev-evangelism/publish.

## 5. Fix-loop pattern

Findings (FBs) raised by adversarial reviewers are addressed by the fix-loop. The fix-loop is **mechanically identical to unit execution**, with the FB file as the work artifact.

### 5.1 FB-as-unit

When a fix-loop dispatches against an FB:
- The FB file IS the unit. The fixer hats read it, edit its body, and complete it via `haiku_feedback_advance_hat` against the FB (the FB-scoped mirror of `haiku_unit_advance_hat`; the unit-scoped tool cannot target an FB).
- Fixer hats MUST NOT edit unit files. The flagged unit is read-only context (read via `haiku_unit_read`); the fixer's deliverable is the FB body (written via `haiku_feedback_write`) populated with diagnosis, root cause, and recommended action.
- The same plan-do-verify pattern applies. The stage's `fix_hats:` list typically contains the implementer hat (per the `fix_hats must be implementer` repo convention) followed by `feedback-assessor` as the terminal verifier — minimum 2 entries today; longer chains are encouraged for stages where a planner step adds value before the implementer runs. The terminal hat validates the FB body and calls `haiku_feedback_advance_hat` to close the FB.
- workflow engine lifecycle enforcement is identical: FBs go pending → active (in fix-loop) → completed.

### 5.2 Closed FBs as input to the next iteration (target state)

A "completed" FB under the FB-as-unit model means its diagnosis is well-formed and the work-of-record is the FB body. The architectural target is that the underlying defect is then patched through the next iteration of the upstream stage's elaborate phase, which consumes the closed FB diagnoses as input and authors new pending units that build on (never modify) completed units.

**Current implementation status:** the FB-as-unit dispatch is wired (commits in this PR). Fixers diagnose into the FB body, the workflow engine auto-closes on advance_hat, and the closed FB persists with its diagnosis. The "elaborate-phase consumes closed FBs as input on next iteration" path is the natural follow-up but is not yet a single explicit code path — today, when a stage's gate revisits elaborate (via `elaborate_revisit`, `feedback_revisit`, or similar), the elaborate-phase prompt has access to the stage's `feedback/` directory contents and is instructed to draft new units that close pending feedback. Closed FBs serve as historical diagnosis the elaborator can inline. Wiring an explicit "consume closed FBs from prior iteration" injection into the elaborate dispatch is a tracked follow-up — see §7.

What's strictly enforced today regardless of the consumer path:
- Existing completed units are never modified by the fix-loop (the hook blocks unit-file edits; fixer prompts forbid them).
- New corrective work, when authored, becomes new pending units (per §1.3 forward-only).

This is why front-loading matters either way. By the time a defect surfaces at the gate, the original units that contain it are permanent. Corrective work happens on top of them, never to them.

## 6. Hook boundary

The PreToolUse hook denies generic file Read/Write/Edit on workflow-managed paths. The hook redirects the agent at the appropriate MCP tool.

Denied paths (Read/Write/Edit):
- `.haiku/intents/*/stages/*/units/*.md`
- `.haiku/intents/*/stages/*/feedback/*.md` and `.haiku/intents/*/feedback/*.md` (intent-scope)
- `.haiku/intents/*/intent.md`
- `.haiku/intents/*/stages/*/state.json`

Denial message format: `"This file is workflow-managed. Use \`haiku_unit_read { intent: \"<slug>\", stage: \"<stage>\", unit: \"<unit>\" }\` instead."`

Bash commands referencing these paths are **soft-warned** (logged, not blocked). The threat model is "honest agent reaches for the wrong tool by habit," not "adversarial agent." Routine MCP usage is the path of least resistance; persistent Bash bypass is anomalous and shows up in audit telemetry.

## 7. Known structural issues — status

Tracking the gap between this document and the implementation. Fix the implementation, not the document. Items marked ✅ have been reconciled in the current PR; ⏳ are still ahead.

1. ✅ **`FSM_CONTRACTS_ELABORATE_BLOCK` build-class assumptions.** Split into `FSM_CONTRACTS_ELABORATE_UNIVERSAL` (rules for every stage) and `FSM_CONTRACTS_ELABORATE_BUILD_ADDENDUM` (build-class-only rules, injected only when no per-stage `phases/ELABORATION.md` override exists). All 5 inception-class stages now skip the build-class addendum because they have their own ELABORATION.md.
2. ⏳ **Inception-class stages structurally over-reach.** **Mostly mitigated:** the 5 inception-class stages now have research-stage ELABORATION.md guidance + body-only knowledge-artifact verifier hats, which steer NEW authoring toward knowledge topics. Cleanup of any pre-existing execution-spec drift in these stages' artifacts (in real intents that have already used them) still ahead — but new intents will use the corrected guidance.
3. ✅ **Hat name `elaborator` collides with phase name `elaborate`** — renamed to `distiller` (role-correct per §3.1) in all 5 inception-class stages: software/inception, hwdev/inception, hwdev/requirements, libdev/inception, gamedev/concept. Other studios' non-inception `elaborator` hats are correctly the do-hat of build chains and don't have the same collision (optional polish: rename them to stage-appropriate `builder`/`composer`/etc., but not architecturally required).
4. ✅ **Build-class stages need their own ELABORATION.md.** `software/development/phases/ELABORATION.md` was already correct; the Phase 2 rollout (parallel agent) added per-stage ELABORATION.md to almost all stages across all 22 studios. Verified 109/120 stages now have a `phases/ELABORATION.md`.
5. ✅ **`haiku_unit_get` migration to workflow engine-internal.** Removed from agent-callable schema (`stateToolDefs`); handler retained for workflow engine-internal callers.

Phase 2 verifier rollout (parallel agent dispatch, commit `af417f69` and earlier):
- 91/120 stages now have a `verifier` (or other verify-class) terminal hat in their `hats:` list.
- The 29 stages without explicit `verifier` already end in a verify-class hat (`reviewer`, `validator`, `assessor`, `auditor`, `qa`, etc.).

Phase 3 adversarial-loop restructure (commit `b4d914cc`):
- ✅ All 3 previously-flagged adversarial-loop stages (software/security, security-assessment/exploitation, ideation/review) restructured to put plan-do-verify before adversarial hats per §3.5. Added 6 new hat mandate files for the new plan/do/verify roles inserted (security-engineer, attack-strategist, exploit-reviewer, review-planner, synthesizer, reviewer).

6. ⏳ **24 `review-agents/cross-stage-consistency.md` files reference FM-derived paths** (e.g., "verify that stages' declared outputs exist at the paths their unit frontmatter promised"). Per §1.1 this is FM-interpretation for a mechanical purpose and should be workflow engine-enforced at `haiku_unit_advance_hat` time instead of agent-validated post-hoc. The strict fix: strip these references and add an workflow engine-level output-existence check. The current behavior is defensive validation pending that workflow engine enforcement and is left in place to avoid removing the only existing safety net.

Implemented in this PR (✅):
- Architecture document itself, with the boundary rules, lifecycle, hat patterns, FB-as-unit fix-loop semantic, and stage-role taxonomy.
- Path-boundary hook (PreToolUse) denying generic Read/Write/Edit on workflow-managed paths, with redirect messages naming the right MCP tool.
- New MCP tools: `haiku_unit_write` (with FM validators + DAG cycle detection + lifecycle), `haiku_unit_read` (body+title only), `haiku_unit_delete` (pending only); FB equivalents `haiku_feedback_write` and `haiku_feedback_read`; FB-as-unit progression tools `haiku_feedback_advance_hat` and `haiku_feedback_reject_hat` (mirrors of unit equivalents).
- Lifecycle enforcement on `haiku_unit_set` (active/completed → locked) and `haiku_feedback_update` (terminal-state-protected).
- Elaborate dispatch routes unit authoring through `haiku_unit_write` (no more raw Write).
- Both fix-loop dispatches (`review_fix` per-stage and `intent_completion_fix` studio-level) rewritten for FB-as-unit: fixers edit FB body via `haiku_feedback_write`, read flagged units read-only via `haiku_unit_read`, progress through fix_hats via `haiku_feedback_advance_hat`. Closure is workflow-driven via the last-hat advance.
- 5 canonical inception-class verifier hats (software/inception, hwdev/inception, hwdev/requirements, libdev/inception, gamedev/concept) — body-only knowledge-artifact validation.
- 5 inception-class `phases/ELABORATION.md` files providing research-stage authoring guidance.
- `CLAUDE.md` cites this document as the canonical structural source of truth and adds 6 concept-mapping rows for the new architecture surface.

## 8. Studio-author checklist

When adding or modifying a stage:

- [ ] Stage role identified (research/design/build/validation/operational/adversarial)
- [ ] What a "unit" IS for this stage is documented in the stage's elaborate contract
- [ ] `hats:` list has at least 3 entries
- [ ] First hat is plan-class, second is do-class, third is verify-class
- [ ] Hat names are distinct from phase names (no `elaborate`/`execute`/`review`/`gate`)
- [ ] Each hat-to-hat handoff has a meaningful baton (rally-race test)
- [ ] Verify hat's mandate is body-only (no FM interpretation)
- [ ] If `fix_hats:` is set, it has at least 2 entries — `[<implementer>, feedback-assessor]` is the conventional minimum (the implementer per the `fix_hats must be implementer` rule; `feedback-assessor` as the terminal verifier). Longer plan-do-verify chains are encouraged where a separate planner step adds value before the implementer.
- [ ] Adversarial hats (if any) come AFTER the plan-do-verify triplet
- [ ] Hat mandate files exist for every named hat (`hats/{name}.md`)
- [ ] No mandate file references `depends_on:`, `inputs:`, `outputs:`, `status:`, or any other FM field as something the agent should read or interpret

When adding or modifying an workflow engine tool:

- [ ] Writes that affect frontmatter run the appropriate validators
- [ ] Lifecycle enforcement (pending/active/completed) is checked
- [ ] Read tools return body + title only unless the caller is workflow engine-internal
- [ ] Tool errors name the rule that fired ("status is `active`; units become immutable once started")

## 9. Source of truth

This document supersedes any conflicting guidance in:
- `website/content/papers/haiku-method.md`
- Per-studio `STUDIO.md` files
- Per-stage `STAGE.md` files
- Hat mandate files (`hats/*.md`)
- `FSM_CONTRACTS_ELABORATE_BLOCK` and related orchestrator constants

When a discrepancy is found, fix the downstream artifact, not this document — unless an explicit revision proposal is approved that updates this file first.
