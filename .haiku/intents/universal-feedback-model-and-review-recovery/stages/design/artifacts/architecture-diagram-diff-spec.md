---
title: Architecture diagram + docs diff spec for universal-feedback-model-and-review-recovery
stage: design
unit: unit-09-architecture-diagram-updates
closes: [FB-05, FB-06, FB-08, FB-09]
scope: diagram-and-docs-sync-only
owns: website/public/prototype-stage-flow.html · website/content/papers/haiku-method.md · CLAUDE.md · plugin/studios/software/stages/design/hats/designer.md (terminology callout)
not_owns: packages/haiku/src/orchestrator.ts · packages/haiku/src/state-tools.ts · packages/haiku/src/server.ts · plugin/bin/haiku (binary) · tests
---

# Architecture diagram + docs diff spec

This is a **specification for the development stage to execute** when it syncs the canonical architecture diagram (`website/public/prototype-stage-flow.html`) and the surrounding methodology docs (paper glossary, `CLAUDE.md` terminology) with the FSM changes introduced by FB-05 / FB-06 / FB-08 / FB-09.

> This document is the authority on **what the diagram must say after the FSM change lands**, not on what the FSM code must do. The diagram follows the orchestrator; when the orchestrator changes, the diagram must be updated to match (per `.claude/rules/architecture-prototype-sync.md`).

## Scope

| In scope (design owns) | Out of scope (product/development/operations own) |
|---|---|
| `website/public/prototype-stage-flow.html` — registries, modals, edge labels, payloads, schema docs | `packages/haiku/src/orchestrator.ts` — revisit atomicity, predicate check, iterations bump |
| `website/content/papers/haiku-method.md` — glossary, stage-iteration definition | `packages/haiku/src/state-tools.ts` — schema migration, hydration shim, `gitCommitState` |
| `CLAUDE.md` — terminology table (new Iteration row; drop legacy notes) | `packages/haiku/src/server.ts` — `haiku_feedback` `message is required` bug |
| Studio content sidecar rebuild (`node website/_build-prototype-content.mjs`) | `plugin/bin/haiku` rebuild + CI enforcement so source ≠ binary can't ship |
| Designer-hat terminology callout (`plugin/studios/software/stages/design/hats/designer.md`) if the rename introduces a breaking phrase the hat references | Any orchestrator test (unit or e2e) |
| Iteration-timeline UI mock for the stage banner (`iteration-timeline-ui.html`) | The stage banner's live integration in `packages/haiku/review-app/` (unit-01/02/05 own the live React wiring) |

**Explicit non-goal.** Anyone reading this spec must not conclude that design owns the FSM rewrite. The diagram is a *downstream representation*; the orchestrator is the source of truth.

---

## 1 · Prototype HTML diff (`website/public/prototype-stage-flow.html`)

### 1.1 · Node / state changes

| Change | What | Why | Where in file |
|---|---|---|---|
| **Remove** | any node, pill, or phase-label called `additive_elaborate` or "additive elaborate" | FB-09: there is no separate state — it's a predicate on the single `elaborate` phase | search for "additive" (currently not present on `main`, but will have been added by in-flight unit-06/07 work — sweep and delete) |
| **Re-annotate** | the `elaborate` phase pill gets a new sub-label `+ gate predicate` and a clickable info chip | FB-09: the post-elab gate is a predicate, not a branch | per-stage `renderStudio()` phase-pill template (search for `phase-pill` that emits `elaborate`) |
| **Add** | new clickable **predicate chip** next to each stage's `elaborate` pill: `⛔ pending_feedback > 0 ∧ uncompleted_units == 0` | FB-09: surface the predicate that blocks advancement | same template — emit a `<span class="predicate-chip">` with `data-predicate="elab-post-gate"` |

### 1.2 · Edge / transition changes

| Edge key | Current label | New label | Notes |
|---|---|---|---|
| `elab-to-execute` (new or existing) | n/a | `predicate passes → execute` | dashed green on success |
| `elab-blocked` (new) | n/a | `⛔ blocked · pending feedback, no new units → stay in elaborate` | dashed red; loops from elaborate back to itself |
| `review-to-elaborate` (feedback-rollback — new) | n/a | `↺ pending feedback → rollback to elaborate · iteration ++` | dashed orange from `review` to same-stage `elaborate`; distinct from cross-stage revisit arrow |
| `revisit-from-{src}-to-{tgt}` (existing ↺ chip) | `/haiku:revisit` | `/haiku:revisit · atomic reset + iteration ++ + intent.status→active` | emphasize **atomic** — FB-05/FB-06 |

### 1.3 · `payloadFor(...)` registry additions

Add / update the following entries in the `payloadFor(stage, idx, mStage, key, opts)` function (approx line 3627 in the current HTML).

#### 1.3.1 · New: `"elab-blocked-pending-feedback"`

```js
"elab-blocked-pending-feedback": {
  injection: [
    { hook: "MCP tool result", target: "agent's `tool_use_result`", what: "list of FB-NN items with `status: pending`, no `closes:`-covering units exist" },
    { hook: "inject-context", target: "next agent prompt prepend", what: "pending feedback frontmatter + bodies; instruction to write units with `closes: [FB-NN]`" },
  ],
  action: "elaborate_blocked_pending_feedback",
  summary: `pending feedback + no new units → cannot advance; agent must write units closing the feedback`,
  payload: {
    action: "elaborate_blocked_pending_feedback",
    pending_feedback: ["FB-01", "FB-02", "FB-03"],
    instruction: "Write new unit(s) with `closes: [FB-NN]` covering every pending feedback item.",
  },
  validations: [
    "read `.haiku/intents/{slug}/stages/{stage}/feedback/*.md` with `status: pending`",
    "count uncompleted units (`status != complete`) in `.haiku/intents/{slug}/stages/{stage}/units/`",
    "predicate: `pending_feedback > 0 && uncompleted_units === 0`",
  ],
  writes: [
    // no state writes — this is a read-only predicate failure that tells the agent what to do
  ],
  instructions: "Orchestrator does NOT advance. The predicate failed. Agent must author new unit files whose `closes:` frontmatter references every pending feedback ID, then re-elaborate.",
}
```

#### 1.3.2 · Update: `"revisit-from-X-to-Y"` (both intra- and cross-stage)

Extend the existing `openRevisitModal(...)` payload block so the **state writes** section enumerates the **atomic set** from FB-05/FB-06:

```js
writes: [
  { path: ".haiku/intents/{slug}/intent.md",
    change: "frontmatter: `status: \"active\"` (if was completed), `completed_at: null`, `active_stage: {target}`" },
  { path: ".haiku/intents/{slug}/stages/{target}/state.json",
    change: "`status: \"active\"`, `phase: \"elaborate\"`, `completed_at: null`, `gate_entered_at: null`, `gate_outcome: null`, `iterations[].push({ n: iterations.length + 1, started_at: now, ended_at: null, outcome: null, triggered_by: \"revisit\", feedback_scope: [FB-NN, …] })`" },
  { path: ".haiku/intents/{slug}/stages/{target}/units/*.md",
    change: "**per FB-06 resolution**: units are KEPT at `status: completed` (old units not re-queued). New units with `closes: [FB-NN]` are authored by the agent in the next elaborate tick." },
  { path: ".haiku/intents/{slug}/stages/{target}/feedback/NN-*.md",
    change: "one file per `reasons[]` entry; `status: \"pending\"`, `origin: \"user-chat\"`, `author: \"user\"`, `visit: iterations.length` (legacy field kept only until the scalar sweep runs)" },
  { note: "All of the above are committed in a SINGLE `gitCommitState` call so the history shows one atomic revisit commit." },
]
```

Also update the existing modal prose (search for `"↺ /haiku:revisit"` around line 4460) **"state writes"** section to enumerate **all four** file paths above, not just `state.json` + `intent.md`. And add a new section:

```html
<div class="modal-section">
  <h3>atomicity guarantee</h3>
  <div class="prose">
    All writes land in one <code>gitCommitState</code>. Either every side-effect lands (intent reactivated, stage reset, feedback files written, iterations array extended) or none do. A half-applied revisit is impossible. This is what FB-05/FB-06 tightened after the 2026-04-17 dogfood regression.
  </div>
</div>
```

#### 1.3.3 · Update: `"gate-to-execute"` validations

Add a new validation to the `gate-to-execute` entry's `validations:` array:

```js
"`pending_feedback == 0 || uncompleted_units > 0` (FB-09 post-elab predicate)",
```

#### 1.3.4 · Update: `"execute-to-review"` → new successor `"review-to-elab-on-pending-feedback"`

The current `execute-to-review` transition leads directly to the gate phase after review agents run. Add a new entry that fires when the next `haiku_run_next` after review detects pending feedback files:

```js
"review-to-elab-on-pending-feedback": {
  injection: [
    { hook: "MCP tool result", target: "agent's `tool_use_result`", what: "pending feedback list + rollback reason banner" },
    { hook: "inject-context", target: "next agent prompt prepend", what: "new iteration record opened; agent re-enters elaborate with feedback_scope" },
  ],
  action: "rollback_phase + open_iteration",
  summary: "review found pending feedback → roll back to elaborate, open new iteration",
  payload: {
    action: "rollback_phase",
    from: "review",
    to: "elaborate",
    triggered_by: "feedback_rollback",
    pending_feedback: ["FB-NN", ...],
    iteration: { n: "iterations.length + 1", triggered_by: "feedback_rollback" },
  },
  validations: [
    "at least one `feedback/*.md` file with `status: pending` exists in the current stage",
    "review phase has already run (review_findings recorded)",
  ],
  writes: [
    { path: ".haiku/intents/{slug}/stages/{stage}/state.json",
      change: "`phase: \"elaborate\"`, `iterations[prev].ended_at = now`, `iterations[prev].outcome = \"revisited\"`, `iterations.push({ n, started_at: now, ended_at: null, outcome: null, triggered_by: \"feedback_rollback\", feedback_scope: [pending FB-NNs] })`" },
  ],
  instructions: "Not a revisit (user didn't invoke it). Orchestrator detected pending feedback on entry to gate and rolled back. Agent re-enters elaborate and must author units with `closes: [FB-NN]` to address the pending items — same predicate as intra-stage advance.",
}
```

### 1.4 · `SCHEMA_DOCS["state.json"]` field list update

The clickable `state.json` schema modal (around line 4340) enumerates the per-stage state fields. Apply these edits:

| Field | Before | After | Rationale |
|---|---|---|---|
| `visits` | not listed (doesn't exist today) or `visits: number` (if added mid-flight) | **removed** — do not list | FB-08 replaces it with `iterations[]` |
| `iterations` | n/a | **add new row**: `{ key: "iterations", type: "IterationRecord[]", desc: "Stage iteration history. iterations[0] is the initial elaboration; subsequent entries are pushed on revisit or feedback-rollback. Replaces the legacy \`visits\` scalar. Hydrates from legacy fields on read if empty." }` | FB-08 first-class iteration timeline |
| `started_at` | (implicit from stage creation) | **mark DEPRECATED** in desc: "Deprecated in favour of `iterations[0].started_at`. Read-side hydration keeps legacy intents working." | FB-08 deprecation path |
| `completed_at` | n/a | **mark DEPRECATED**: "Deprecated in favour of `iterations.at(-1).ended_at`." | FB-08 |
| `gate_entered_at` | n/a | **mark DEPRECATED**: "Deprecated; iteration records carry entry timestamps." | FB-08 |
| `gate_outcome` | `"pending" \| "approved" \| "changes_requested" \| "external_review" \| null` | keep — but mark DEPRECATED in desc: "Deprecated at stage level; iteration records carry per-iteration `outcome`. Read-side readers should use `iterations.at(-1).outcome`." | FB-08 |
| `phase` | existing enum | **add value**: update enum to include note about the `elaborate` phase's post-gate predicate — "Before advancing from `elaborate` to `execute`, orchestrator evaluates `pending_feedback > 0 && uncompleted_units === 0`; if true, returns `elaborate_blocked_pending_feedback` instead of advancing." | FB-09 |

Also add a new schema doc entry:

```js
"iteration-record": {
  title: "IterationRecord (entry in state.json `iterations[]`)",
  summary: "First-class record of one stage iteration — initial elaboration or a revisit/feedback-rollback cycle. Replaces the legacy `visits: number` scalar.",
  fields: [
    { key: "n", type: "number (1-indexed)", desc: "Iteration number. `iterations[0].n === 1`." },
    { key: "started_at", type: "ISO-8601", desc: "When this iteration opened." },
    { key: "ended_at", type: "ISO-8601 | null", desc: "When this iteration closed. `null` while active — only the last iteration may have `ended_at: null`." },
    { key: "outcome", type: `"advanced" | "revisited" | "abandoned" | null`, desc: "Terminal state for this iteration. `null` while active. Only the final iteration may have `outcome: \"advanced\"`." },
    { key: "triggered_by", type: `"initial" | "revisit" | "feedback_rollback"`, desc: "What opened this iteration. `iterations[0].triggered_by === \"initial\"`." },
    { key: "feedback_scope", type: "string[] (optional)", desc: "Feedback IDs (FB-NN) that caused this iteration to open. Empty/absent on the initial iteration." },
  ],
  written_by: "`packages/haiku/src/orchestrator.ts` — revisit, feedback-rollback, advance-stage code paths",
  hydration: "On read, if `iterations` is missing/empty, the orchestrator synthesizes a legacy-compatible list from `visits`, `started_at`, `completed_at`, `gate_outcome`. No hard migration — next legitimate write persists the new shape.",
}
```

Make `iterations` in the `state.json` field list clickable to open this new schema modal (same pattern as other in-line `state.json` references).

### 1.5 · Terminology-drift callout update

The existing terminology-drift callout in the User-actor modal (search for "terminology drift") currently mentions HITL/OHOTL/AHOTL. Keep that callout. Add a sibling callout:

> **Iteration vs Bolt.** `iteration` is a stage-level cycle (revisit or feedback-rollback). `bolt` is a unit-level cycle (hat rejection). They are distinct concepts with distinct frontmatter fields; both are first-class. The paper, CLAUDE.md terminology table, and this prototype's Hierarchy box all reflect this.

### 1.6 · Hierarchy box update

Search for the text:

```
Studio > Stage > Unit > Bolt
```

(appears in both CLAUDE.md reference modals and the prototype's Hierarchy actor modal)

**Add** below it:

```
stage has iterations (revisit cycles) · unit has bolts (hat-rejection cycles)
```

### 1.7 · `HOOKS` / `STAGES` / `ACTORS` registries

**No changes required from FB-05/06/08/09 alone.** FB-07 introduced the `feedback-assessor` review-agent (owned by unit-08), so `STAGES[review].review-agents` is handled in that unit. No new hooks for this unit. No new actors.

### 1.8 · Studio content sidecar rebuild

After any `plugin/studios/**` change lands (FB-07/unit-08 will likely touch `stages/*/review-agents/feedback-assessor.md`), run:

```
node website/_build-prototype-content.mjs
```

This refreshes the bundled studio-content sidecar (`website/public/prototype-studio-content.json`) that the prototype loads for clickable hat / review-agent / discovery / outputs modals.

**This unit (unit-09) does not itself modify `plugin/studios/**`.** The sidecar rebuild is listed here so the development stage doesn't forget it when it bundles unit-08 and unit-09 changes in a single shipping pass.

---

## 2 · Paper diff (`website/content/papers/haiku-method.md`)

### 2.1 · Glossary additions

In the methodology paper's terminology section (the "HAIKU Hierarchy" / glossary block — search for "Studio > Stage > Unit > Bolt"):

- **Add a row** for **Iteration**:

  > **Iteration** — A stage-level cycle. The first iteration is the initial elaborate→execute→review pass; subsequent iterations open when `haiku_revisit` fires or when the review phase detects pending feedback and rolls the stage back to elaborate. Each iteration carries a `started_at`, `ended_at`, `outcome`, `triggered_by`, and optional `feedback_scope`. Analogous at the stage level to what Bolt is at the unit level.

- **Update** the Hierarchy block:

  ```
  Studio > Stage > Unit > Bolt
  (stage has iterations · unit has bolts)
  ```

### 2.2 · Feedback + revisit section (if present)

If the paper has an Execution / Review / Backpressure section that describes the review → gate transition, update the prose to reflect:

- Review findings persist as `feedback/NN-*.md` files, not chat-context.
- The FSM **structurally** blocks advancement when pending feedback exists; the agent cannot override this.
- Revisit is atomic: one commit, all side-effects (intent reactivation, stage reset, feedback files, iteration record) apply together.
- The post-elab gate is a predicate (`pending_feedback > 0 && uncompleted_units === 0`), not a separate state called `additive_elaborate`.

If the paper does not currently describe these — the paper has lagged behind the implementation — note that as follow-up work. This unit does not own rewriting those sections, only flagging what needs to be added.

### 2.3 · Remove legacy `additive_elaborate` mentions

Search the paper for:

- `additive_elaborate`
- `additive elaborate`
- `visits` (as a stage-level term)

Replace with the new predicate-and-iterations model. If the term does not appear, no change — but still verify with a grep as part of the sync pass.

---

## 3 · `CLAUDE.md` diff

### 3.1 · Terminology table — add Iteration row

In the "H·AI·K·U Terminology (CRITICAL)" table, add a new row between **Bolt** and **Studio** (or wherever the table groups stage-related terms):

| H·AI·K·U Term | Agile Equivalent | Description |
|---|---|---|
| **Iteration** | (no equivalent — closest is "sprint retrospective round") | A stage-level cycle. `iterations[0]` is the initial elaborate pass; subsequent entries are pushed when `haiku_revisit` or feedback-rollback re-opens the stage. Each record: `n`, `started_at`, `ended_at`, `outcome`, `triggered_by`, optional `feedback_scope`. Stage-level analogue of Bolt (which is unit-level). |

### 3.2 · Hierarchy block update

Below:

```
Studio > Stage > Unit > Bolt
```

Add:

```
- **Iteration** is stage-level — stage revisit / feedback-rollback cycles (`state.json iterations[]`).
- **Bolt** is unit-level — hat-rejection cycles (`unit.md bolt`).
- Iterations and Bolts are distinct concepts with distinct frontmatter.
```

### 3.3 · Concept-to-Implementation mapping — add Iteration row

In the concept table, add:

| Concept | Paper Section | Plugin Implementation | Key Files |
|---|---|---|---|
| **Iteration** | Execution phase | `iterations[]` array in `state.json`; appended by revisit / feedback-rollback | orchestrator.ts, state-tools.ts |

### 3.4 · Review Gate row — add predicate note

Update the existing **Review Gate** row's Description column to append:

> **Post-elab gate is a predicate, not a state.** Before advancing from `elaborate` to `execute`, the orchestrator evaluates `pending_feedback > 0 && uncompleted_units === 0`; if true, it blocks and returns `elaborate_blocked_pending_feedback`. This replaces the previously-discussed `additive_elaborate` state.

---

## 4 · Designer hat file (`plugin/studios/software/stages/design/hats/designer.md`)

**Likely no change.** The designer hat talks about wireframes, tokens, mockups — no stage-iteration terminology. Verify with a grep for `visits`, `additive`, `iteration` during the sync pass. If any hat file references the legacy terms, update them.

---

## 5 · Iteration-timeline UI mock — cross-reference

The sibling artifact `iteration-timeline-ui.html` in this same directory is the visual spec for how the stage banner renders the iteration list. It must be produced alongside this diff spec.

Key integration points from the mock that the development stage must respect:

- The stage banner (in the Review UI) reads `state.json.iterations[]` and renders the list inline.
- Active iteration (the one with `ended_at: null`) is visually distinct — "Iteration 2 of 2 · started 2026-04-16 21:04".
- Each record exposes a hover tooltip with `outcome`, `triggered_by`, and `feedback_scope`.
- Closed iterations are muted; the active iteration carries an accent outline.
- Empty / missing `iterations` hydrates from legacy fields (FB-08) and renders a single "Iteration 1" entry — no crash, no empty state.

The Review UI integration in `packages/haiku/review-app/**` is owned by unit-01/02/05 (feedback panel, comment-to-feedback flow, lifecycle ownership); this unit only produces the visual spec.

---

## 6 · Product / development hand-off list

Items outside design's scope that this intent still needs to land before delivery. Each one belongs to product or development:

| Concern | Owner | Trigger |
|---|---|---|
| Revisit atomicity implementation (`uncompleteIntent`, stage reset, units kept, iterations push, single `gitCommitState`) | product elaboration → development execute | FB-05, FB-06 |
| Post-elab gate predicate (`pending_feedback > 0 && uncompleted_units === 0` evaluated before `elab → execute`) | product → development | FB-09 |
| `state.json` schema: `visits` → `iterations: IterationRecord[]` with hydration shim | product → development | FB-08 |
| `haiku_feedback` MCP tool — `message is required` bug: error payload cites field that doesn't exist in the tool's schema | development (bug fix) | FB-06 symptom 5 |
| Collapse `additive_elaborate` action from orchestrator (partial in-flight from unit-06 work); replace with predicate + `elaborate_blocked_pending_feedback` action | product → development | FB-09 |
| `plugin/bin/haiku` rebuild enforcement — CI or pre-commit hook blocks source changes without binary rebuild | operations | FB-06 symptom 6 |
| End-to-end test: seed completed intent → `haiku_revisit(stage, reasons[])` → assert atomic reset + iteration record + feedback files → `haiku_run_next` returns `elaborate_blocked_pending_feedback` | development (test harness) | FB-06 test harness requirement |
| Feedback-rollback in review phase: on entry to gate, evaluate pending feedback; if any, roll back to elaborate with new iteration record (`triggered_by: "feedback_rollback"`) | product → development | FB-07 (owned by unit-08), FB-09 |

This list is for coordination, not duplication. Product's planning stage will decompose these into its own units.

---

## 7 · Sync-check before delivery

Per `.claude/rules/sync-check.md` and `.claude/rules/architecture-prototype-sync.md`, before this intent's `delivery` stage considers itself complete:

- [ ] `website/public/prototype-stage-flow.html` changes above applied, visually verified at `http://localhost:3000/prototype-stage-flow.html`
- [ ] `node website/_build-prototype-content.mjs` re-run (picks up unit-08's `feedback-assessor` + any other studio changes)
- [ ] `website/_screenshot.mjs` regenerated for the all-modes capture (optional but cheap)
- [ ] `website/content/papers/haiku-method.md` glossary + execution-phase prose updated
- [ ] `CLAUDE.md` terminology table + concept-to-implementation table + hierarchy prose updated
- [ ] Grep sweep for `additive_elaborate`, `additive elaborate`, and stage-level `visits` across `website/`, `packages/haiku/`, `plugin/`, `.claude/rules/`, and CLAUDE.md — all hits resolved (removed, renamed, or marked deprecated with migration note)
- [ ] Designer hat file and other hat files grep-swept for legacy terms (should be clean, but verify)

## 8 · Reference — why these four feedback items cluster

- **FB-05** — revisit atomicity (reset stage + uncomplete intent). Fundamental correctness bug.
- **FB-06** — end-to-end broken dogfood: proves the revisit→additive-elaborate flow is incoherent in v1 implementation. Names `haiku_feedback` "message is required" bug and binary drift as symptoms.
- **FB-08** — `visits: N` → `iterations: IterationRecord[]`. Data model first-class upgrade.
- **FB-09** — post-elab gate is a predicate, not a state (delete `additive_elaborate`). Simplification that removes a whole FSM node.

These four land together because the diagram can't be updated coherently without all four: the revisit arrow, the predicate chip, the iteration-record schema, and the deletion of `additive_elaborate` are one conceptual unit.
