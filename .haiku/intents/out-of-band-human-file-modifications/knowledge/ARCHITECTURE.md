# Architecture

*Living document recording significant architectural decisions for the H·AI·K·U codebase. Persists across intents. Written for future readers who need to understand why the system is shaped the way it is.*

This artifact is the development-stage discovery output for the `out-of-band-human-file-modifications` intent. It captures the architecture as it is becoming after the drift-detection subsystem lands, alongside the architecture as it already exists. Where this document records a *new* shape introduced by the current intent, the section says so explicitly; the rest is steady-state documentation of how the codebase has been shaped by prior intents and which is being preserved.

The companion documents are:

- `plugin/studios/ARCHITECTURE.md` — canonical structural rules for studios, stages, hats, and feedback. That doc binds across studios; this one binds across the whole repository (plugin, paper, website, MCP server).
- `stages/design/artifacts/ARCHITECTURE.md` — design-stage technical-design document specific to the drift-detection feature this intent ships. That document specifies *what* the drift subsystem must do; this document specifies *where in the codebase* it goes and *why* it integrates the way it does.

When the two design-stage architecture documents and this development-stage architecture document disagree, the design document is authoritative for behavioral contract; this document is authoritative for code layout, dependency direction, and integration points.

---

## 1. Module Map

The repository is a monorepo with three top-level deliverables that share a single git history and a single sync discipline (defined in the root `CLAUDE.md`):

```
/
├── packages/haiku/        # The MCP server (TypeScript). The runtime brain.
├── plugin/                # The Claude Code plugin (markdown + shell + JSON).
├── website/               # Next.js 15 static site. Paper, docs, review SPA.
├── deploy/                # Terraform for website hosting.
├── examples/              # Example intents demonstrating the lifecycle.
└── CHANGELOG.md           # Keep-a-Changelog format. CI-managed.
```

The three deliverables are not equal in dependency direction. The plugin and website both depend on the MCP server's contracts; the MCP server does not depend on either. The plugin and website do not depend on each other directly, but they share a common substrate (the MCP server's tool surface) and are coordinated through the sync discipline in `CLAUDE.md`.

### 1.1 `packages/haiku/` — The MCP Server

This is the load-bearing module. Every workflow tick, every hat dispatch, every state transition flows through here. The server exposes its capability surface as MCP tools; agents call those tools; the server reads disk, derives the next action, and emits responses.

The internal layout reflects this single responsibility:

```
packages/haiku/src/
├── server.ts              # Top-level MCP server bootstrap and request routing.
├── orchestrator.ts        # Action emission shell. Most logic delegates to:
├── orchestrator/
│   ├── workflow/          # Tick lifecycle, derive-state, pre-tick gates,
│   │                      # per-state handlers. The state machine.
│   ├── prompts/           # Prompt scaffolding emitted as part of action payloads.
│   ├── revisit.ts         # /haiku:revisit dispatch & branch reattachment logic.
│   ├── studio.ts          # Studio config loader (plugin/studios/{name}/STUDIO.md).
│   ├── tool-defs.ts       # MCP tool input/output schemas.
│   ├── units.ts           # Unit DAG topology, completion fan-in.
│   ├── external-review.ts # External-gate (PR/MR merge) detection for `external:` review type.
│   ├── validators.ts      # Frontmatter validation entry points.
│   ├── actions.ts         # Action shape constants & guard helpers.
│   └── preview.ts         # Discrete-mode preview computation for `revisit`.
├── state-tools.ts         # Resource-shaped MCP tool implementations
│                          # (haiku_unit_*, haiku_feedback_*, haiku_intent_*,
│                          #  haiku_knowledge_*, etc.).
├── tools/                 # Tool dispatch infrastructure (define helpers, registry).
├── hooks/                 # PreToolUse / PostToolUse / Stop hook entry points.
├── http/                  # Built-in HTTP server (review SPA backend, file serving,
│                          # session APIs, WebSocket upgrade for live preview).
├── prompts/               # MCP prompt handlers (skill bridges).
├── state/                 # Shared state primitives (isGitRepo, findHaikuRoot).
├── server/                # Tool-call routing (the router from MCP method to tool fn).
├── harness.ts             # Capability registry per harness (Claude Code, Cowork, MCPB).
├── harness-instructions.ts# Adapts agent-facing strings per harness.
├── git-worktree.ts        # Worktree creation, locking, removal, parking.
├── repair-agent.ts        # `/haiku:repair` driver — scans for state inconsistencies.
├── state-integrity.ts     # Tamper detection (frontmatter hash + sealed fields).
├── workflow-fields.ts     # Sealed frontmatter field registry.
├── studio-reader.ts       # Read studio markdown definitions (STAGE.md, hats/*.md).
├── current-state.ts       # Single-line current-state read for shell hooks.
├── derive-state           # (in orchestrator/workflow/) — pure state derivation.
├── markdown.ts            # Frontmatter + body split + reassembly.
├── parser.ts              # Markdown / YAML parsing helpers.
├── dag.ts                 # Directed-acyclic-graph cycle detection on units.
├── config.ts              # Config file resolution (project + user).
├── auto-update.ts         # Plugin self-update mechanism.
├── session-id.ts          # MCP session ID derivation & persistence.
├── session-metadata.ts    # Per-session metadata storage.
├── sentry.ts              # Sentry integration (off by default).
├── telemetry.ts           # Opt-in telemetry events.
├── tunnel.ts              # localtunnel wiring for HAIKU_REMOTE_REVIEW.
├── migrate.ts             # AI-DLC → H·AI·K·U schema migration.
└── version.ts             # Version stamp from package.json.
```

The directory boundaries above are *load-bearing*. Crossing them without good reason creates churn. The most-frequently-touched boundaries:

- **`orchestrator/workflow/` is the state machine.** Adding a new workflow action means editing the dispatch handler under `handlers/` AND the action enum AND the discriminated-union type in `actions.ts`. Code outside `orchestrator/workflow/` MUST NOT call handlers directly — go through `runWorkflowTick`.
- **`state-tools.ts` owns disk-shaped resource MCP tools.** This file is large (~10kloc) and is the single point of truth for unit/feedback/knowledge/intent CRUDL. It is intentionally not split per-resource: every tool needs the same path-resolution and frontmatter-validation primitives, and putting them in one file keeps the call surface explicit. New resource tools are added here, not in side files.
- **`hooks/` is for harness-side enforcement only.** Hooks fire from the Claude Code (or other harness) hook lifecycle and are the *only* place where agent tool calls can be denied/redirected at the request level. Logic inside hooks must be defensive — they run with limited context and must not crash the harness.
- **`http/` is the SPA backend.** This is a real HTTP server that comes up alongside the MCP server when the review surface is needed. It is *not* the MCP server's request handler; the two share a process but have separate routing trees.

### 1.2 `plugin/` — The Claude Code Plugin

The plugin is markdown + JSON + shell. There is no compiled code in here. Everything in `plugin/` is read at runtime by the MCP server (for studio definitions and hooks) or by the harness (for skills).

```
plugin/
├── .claude-plugin/
│   └── plugin.json                # Plugin manifest. Version is auto-bumped.
├── skills/                        # Slash-command skill files (`/haiku:start`, etc.)
│                                  # Skills are thin wrappers that call MCP tools.
├── studios/                       # Studio definitions.
│   ├── ARCHITECTURE.md            # CANONICAL studio-structure reference.
│   ├── software/                  # The flagship studio.
│   │   ├── STUDIO.md
│   │   ├── stages/
│   │   │   ├── inception/
│   │   │   ├── product/
│   │   │   ├── design/
│   │   │   └── development/
│   │   │       ├── STAGE.md
│   │   │       ├── hats/         # Per-hat behavioral roles.
│   │   │       ├── review-agents/
│   │   │       ├── phases/        # Optional phase overrides.
│   │   │       └── discovery/     # Discovery artifact templates (incl. ARCHITECTURE.md).
│   │   ├── operations/            # /haiku:operate templates.
│   │   ├── reflections/           # /haiku:reflect dimensions.
│   │   ├── review-agents/         # Studio-level (intent-completion) review.
│   │   ├── fix-hats/              # Studio-level intent-completion fix hats.
│   │   └── templates/             # Intent and unit templates.
│   ├── (other studios — paper, voice, etc.)
├── providers/                     # Bidirectional translation instructions per VCS.
├── schemas/providers/             # JSON schemas for provider configuration.
├── hooks/                         # Hook shell scripts (delegate to compiled MCP).
├── lib/                           # Shell helpers used by hooks and skills.
├── data/                          # Static reference data.
├── harnesses/                     # Per-harness adaptation hints.
├── passes/                        # Quality-gate check definitions.
└── bin/                           # Wrapper scripts.
```

`plugin/studios/ARCHITECTURE.md` is the canonical reference for what shape a studio has. It is more authoritative than this document for studio/stage/hat structure. This document defers to it on those topics.

### 1.3 `website/` — Next.js 15 Static Site

The website is the public face: paper, docs, glossary, blog, browse UI, and the review SPA. Static generation everywhere except the review SPA's WebSocket and API routes.

```
website/
├── app/                          # Next.js App Router.
│   ├── studios/[slug]/architecture/  # Architecture map (interactive prototype).
│   ├── browse/                       # Intent browser.
│   ├── review/                       # Review SPA (the ReviewPage).
│   ├── docs/, paper/, blog/, glossary/, methodology/, ...
├── content/                      # Markdown content.
│   ├── papers/haiku-method.md    # The methodology paper. Source of truth.
│   └── docs/                     # User-facing documentation.
├── public/
│   ├── workflow-diagrams/        # Auto-generated Mermaid state diagrams per studio.
│   └── prototype-stage-content.json # Studio content sidecar for arch map.
├── _build-prototype-content.mjs  # Pre-build script that emits the JSON sidecar.
└── scripts/                      # Build helpers.
```

The website's review SPA is served by Next.js but talks to the MCP server's HTTP module (under `packages/haiku/src/http/`) for live data. The MCP server runs in the user's local environment; the website never proxies session data through deployed infrastructure.

### 1.4 Cross-Cutting

- **Sync discipline** lives in the root `CLAUDE.md` and `.claude/rules/sync-check.md`. It defines the matrix of "if you change X here, you must also update Y there." This is enforced by review, not by code.
- **Plugin version** is in `plugin/.claude-plugin/plugin.json` and is auto-bumped by CI on merges that touch plugin files. The CHANGELOG follows Keep-a-Changelog format and is also CI-managed; manual edits are reverted.

---

## 2. Data Flow

### 2.1 The Tick

The H·AI·K·U workflow is a tick-driven state machine. The agent (Claude or another model) calls `haiku_run_next` (or one of the tools that internally drives a tick — `haiku_unit_advance_hat`, `haiku_feedback_advance_hat`, etc.); the MCP server reads disk, derives the current state, runs pre-tick gates, dispatches the per-state handler, and returns an action payload. The action payload tells the agent (or harness) what to do next: spawn subagents, run a review, advance a unit, present a gate, etc. State of record is on disk at all times — there is no in-memory state machine.

```
┌─────────┐  haiku_run_next   ┌──────────────┐
│  Agent  │  ─────────────▶   │  MCP server  │
└─────────┘                   │              │
     ▲                        │  1. read disk
     │  action payload        │  2. derive state
     │  (tool_use_result)     │  3. pre-tick gates
     │                        │  4. dispatch handler
     │                        │  5. emit action
     └────────────────────────┴──────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Disk state  │
                              │  (.haiku/    │
                              │   intents/…) │
                              └──────────────┘
```

The pre-tick gate chain (in `runWorkflowTick`, file `orchestrator/workflow/run-tick.ts`) is the load-bearing entry point. After this intent's drift-detection subsystem lands, the chain reads:

```
preTickConsistency        # Self-repair of structural state inconsistencies.
       │
       ▼
verifyIntentState         # Tamper detection on sealed frontmatter.
       │
       ▼
preTickFeedbackGate       # Triage open feedback; relocate cross-stage; revisit if needed.
       │
       ▼
preTickDriftGate          # NEW: SHA baseline vs disk; emit drift events.
       │
       ▼
dispatchHandler(state)    # Per-state handler runs.
       │
       ▼
return { state, context, action }
```

Each pre-tick gate may short-circuit and return its own action. The order matters: tamper detection must run before any other gate (a tampered intent must not advance for *any* reason); feedback triage must run before drift detection (cross-stage feedback may relocate files between stages, which would be misclassified as drift if the drift gate ran first); per-state dispatch runs last and is bypassed when an earlier gate fires.

### 2.2 Hat Dispatch (Execute Phase)

Within a stage's execute phase, units are dispatched against ordered `hats:` sequences declared in `STAGE.md`. Each hat runs as a Task subagent (a child Claude invocation in the harness). The execute handler emits a `tool_use_result` carrying the hat's prompt; the harness spawns the subagent; the subagent does its work using whatever tool it needs, then calls `haiku_unit_advance_hat` (success) or `haiku_unit_reject_hat` (failure).

The advance call internally drives the next workflow tick, which produces the next action: either the next hat in the sequence (the parent agent spawns it), or the verifier hat, or — when the last hat advances — a transition to the review or gate phase.

This subagent-fan-out pattern is what gives H·AI·K·U its parallelism. Per-unit work runs in parallel across multiple subagents within a wave; per-discovery-template fan-out also uses Task subagents (as does the discovery dispatch that produced *this* document).

### 2.3 The Action Surface

The MCP server's action surface is a discriminated union (in `orchestrator/actions.ts`). Every action has an `action: string` discriminator and a payload shape. The full set today (additions from this intent are marked NEW):

```
"haiku_intent_create" / "haiku_select_studio"  # Pre-intent flow.
"elaborate" / "execute" / "review" / "gate"     # Per-stage phases.
"feedback_triage" / "feedback_dispatch"         # Pre-tick feedback gates.
"review_fix"                                    # Per-finding fix-loop dispatch.
"intent_completion_review"                      # Studio-level review gate.
"intent_completion_fix"                         # Studio-level fix loop.
"revisited"                                     # Pre-tick triage redirected to earlier stage.
"intent_complete"                               # Terminal action.
"safe_intent_repair"                            # preTickConsistency self-repair.
"error"                                         # Unrecoverable error surfaced to agent.
"manual_change_assessment"                      # NEW: drift-classification dispatch.
```

Adding a new action requires updating the discriminated union, the per-action prompt scaffolding, the workflow handlers that emit it, the architecture-prototype map (`website/app/studios/[slug]/architecture/`), and the per-studio Mermaid `stateDiagram-v2` files (auto-regenerated). The `architecture-prototype-sync.md` rule enumerates the surfaces that must move together.

### 2.4 Disk Layout per Intent

```
.haiku/intents/{slug}/
├── intent.md                    # Intent root. Workflow-managed (sealed frontmatter).
├── knowledge/                   # Intent-scope knowledge artifacts.
│   ├── DESIGN-DECISIONS.md      # Inception-stage discovery output.
│   ├── DISCOVERY.md
│   ├── ARCHITECTURE.md          # ← THIS FILE (development-stage discovery).
│   └── …
├── stages/{stage}/
│   ├── state.json               # Per-stage state. Workflow-managed.
│   ├── units/unit-NN-*.md       # Unit specs. Workflow-managed.
│   ├── feedback/FB-NN.md        # Feedback items. Workflow-managed.
│   ├── artifacts/               # Stage outputs (the canonical name, see §6).
│   ├── knowledge/               # Stage-scope knowledge.
│   ├── discovery/               # Stage discovery artifacts (incl. this file's siblings).
│   ├── decision_log.json        # Append-only design-decision register.
│   ├── baseline.json            # NEW: drift-detection SHA baseline.
│   └── drift-assessments/       # NEW: durable assessment records.
│       └── DA-NN.json
├── drift-markers.json           # NEW: pending-assessment markers (intent-scoped).
├── write-audit.jsonl            # NEW: human-attributed-write audit log.
└── feedback/                    # Intent-scope feedback (post-intent-completion-review).
```

The "workflow-managed" annotation indicates files that the PreToolUse hook denies to the agent's generic Read/Write/Edit tools. Those files MUST be accessed through MCP tools that enforce lifecycle invariants (frontmatter validation, sealed-field protection, status transitions, DAG cycle detection, etc.).

The new files this intent introduces (`baseline.json`, `drift-assessments/`, `drift-markers.json`, `write-audit.jsonl`) are NOT added to the workflow-managed file set. The reasoning is in §3 below.

---

## 3. Key Abstractions

### 3.1 Workflow-Managed Files vs. Tracked-Surface Files

These are two distinct categories with overlapping intent but different enforcement and ownership:

| Category | Enforcement | Owner | Examples | Drift detection? |
|---|---|---|---|---|
| Workflow-managed files | PreToolUse hook denies generic Read/Write/Edit; agents go through MCP tools | Workflow engine (sealed frontmatter, lifecycle invariants) | `units/*.md`, `feedback/*.md`, `intent.md`, `state.json` | NO (see §3.3) |
| Tracked-surface files | None at agent level (agents may write directly) | The drift-detection subsystem | `knowledge/`, `stages/{stage}/artifacts/`, `discovery/` | YES |
| Internal state files | NEW — written only by the drift subsystem | Drift subsystem | `baseline.json`, `drift-markers.json`, `write-audit.jsonl`, `drift-assessments/` | NO (subsystem-internal) |

The architectural separation is deliberate. Workflow-managed files have hard structural integrity guarantees: their frontmatter is sealed, their lifecycle is enforced (pending → active → completed for units; open → closed → rejected for feedback), and they are the workflow engine's substrate. Drift detection on workflow-managed files would create double-coverage with the existing tamper-detection gate and would conflict with the workflow engine's exclusive write semantics.

Tracked-surface files are the human-collaborative substrate: knowledge artifacts the elaboration phase reads, stage outputs (figma exports, HTML mocks, design tokens), discovery artifacts produced by fan-out subagents. These are the files humans legitimately want to edit out-of-band. Drift detection exists for this category specifically.

Internal state files (the new files this intent introduces) are the drift subsystem's own private substrate. They are written only by the drift gate, the human-attributed-write MCP tool, and the assessment-classification path. They are NOT in the tracked surface (so the gate doesn't try to detect drift on its own bookkeeping), and they are NOT workflow-managed (they don't have sealed frontmatter or lifecycle invariants). They are excluded from the `haiku_human_write` tool's allowed paths so even an explicit human-attributed write cannot corrupt them.

### 3.2 The Author-Class Triple

Every drift-tracked file carries an `author_class` field with one of three values:

- **`agent`** — written by the agent through its normal MCP tool pipeline (Write, Edit). The default class for every file the agent produces during hat execution.
- **`human-via-mcp`** — written through a sanctioned human-mediated channel: either the `haiku_human_write` MCP tool (the conversational pathway: "hey claude, write this file for me") or the SPA upload affordance (the browser pathway: drag-and-drop a file in the review UI). Both channels stamp an action-log entry at write time.
- **`human-implicit`** — inferred. The file's SHA changed in the working tree but no agent stamp and no sanctioned-channel stamp exists in the action log for the affected path. The drift gate infers this class for filesystem-drop edits.

The three values are the *full* taxonomy; there is no fourth class. The class on a baseline entry reflects the most recent acknowledged write, not a history of writes. This is intentional: the class is a routing signal for the assessment classifier, not an audit log. The audit trail lives in `write-audit.jsonl` for `human-via-mcp` writes and in the assessment records for everything the classifier touched.

### 3.3 The Tick as Reconciliation Unit

The eventual-consistency concurrency model rests on a single architectural observation: the tick is the only point at which the workflow engine reads its inputs. Between ticks, the world can shift arbitrarily (the agent writes files mid-bolt; a human edits a knowledge artifact; the SPA uploads a replacement; a git operation rebases history). When the next `haiku_run_next` arrives, the engine reads disk, computes its derivations, and emits its next action.

This means there is no real-time event path from filesystem to engine. A human's edit is invisible until the next tick. A mid-bolt partial state is visible to the next tick exactly as it is on disk at tick time. There is no locking, no optimistic concurrency, no retry-on-conflict.

This shape is what makes the system tractable. Adding a real-time event path (a daemon file-watcher, an inotify subscription, etc.) would multiply the failure modes and introduce a persistent process where today there is only an MCP server that responds to requests. The drift-detection subsystem leans into this — it is a pre-tick gate that runs *exactly once per tick*, computes SHAs *exactly once per tick*, and emits drift events *exactly once per tick*. The cost (drift is detected at most one tick late) is acceptable; the benefit (no daemon, no race conditions across ticks, deterministic replay) is foundational.

### 3.4 The Subagent Boundary

Hat dispatch and discovery fan-out both use Claude Task subagents. The parent agent (the one talking to the user) never does the per-unit work; it spawns subagents and they do it.

This boundary has two implications for code structure:

- **Subagent prompts must be self-contained.** The MCP server emits a prompt file (under `subagent-prompt-file.ts`) with all the context the subagent needs: intent goal, stage scope, hat instructions, the unit body, sibling references. The subagent does not have access to the parent's chat history. Anything the subagent needs must be in the prompt.
- **Subagents call MCP tools to communicate results.** A hat subagent calls `haiku_unit_advance_hat` to signal success; the call also drives the next workflow tick internally. The parent agent learns the result by reading the action payload that comes back; it does not directly read the subagent's transcript.

This is what makes the workflow engine robust. The parent's only job is to spawn subagents and wait for their MCP calls. The state machine doesn't depend on the parent's chat continuity.

### 3.5 The Resource-Tool Surface

State-tools.ts exposes resource-shaped MCP tools rather than command-shaped ones. The pattern: one tool per resource per operation.

```
haiku_unit_write       # Create or rewrite a unit (FM validation, DAG check, lifecycle).
haiku_unit_read        # Read body+title only (FM is workflow-engine territory).
haiku_unit_list        # List units in a stage with their statuses.
haiku_unit_set         # Update one FM field (lifecycle-enforced).
haiku_unit_delete      # Delete (pending only).
haiku_unit_advance_hat # Progress to next hat in sequence (tick-driving).
haiku_unit_reject_hat  # Reject current hat (tick-driving).
haiku_unit_start       # Lifecycle: pending → active.
haiku_unit_increment_bolt  # Bolt counter increment.

haiku_feedback         # Create a feedback item.
haiku_feedback_write   # Update body (lifecycle-enforced).
haiku_feedback_read    # Read body+title only.
haiku_feedback_update  # Status transitions.
haiku_feedback_reject  # Mark invalid.
haiku_feedback_advance_hat / reject_hat  # FB-as-unit fix loop hat progression.
haiku_feedback_move    # Cross-stage relocation (file move + URL rewrite).
haiku_feedback_delete / list

haiku_intent_create / get / list / archive / unarchive / reset
haiku_knowledge_read / list
haiku_decision_record  # Append to decision_log.json.
haiku_repair           # Repair-agent driver.
haiku_review_open      # Surface review SPA URL.
haiku_run_next         # Advance the workflow tick.
haiku_select_studio    # Pre-intent studio selection.
haiku_settings_get
haiku_stage_get / haiku_studio_get / haiku_studio_list
haiku_human_write      # NEW: human-attributed write through agent.
haiku_classify_drift   # NEW: record manual_change_assessment outcomes.
```

The resource-tool shape was chosen deliberately. Command-shaped tools ("write this thing for the agent") leak implementation: the caller has to know what frontmatter the call needs to populate, what lifecycle the resource is in, what side effects are required. Resource-shaped tools ("create a unit," "advance a unit's hat") let the workflow engine own those concerns; the agent only specifies *what resource* and *what intent*.

This shape is also what enables the workflow-managed-file boundary. Because the only path to write a unit is `haiku_unit_write`, the PreToolUse hook can deny generic Write to `units/*.md` without breaking anything — the agent can still get its work done through the correct channel.

---

## 4. Dependency Graph

### 4.1 External Dependencies (`packages/haiku/`)

The MCP server's external dependencies are deliberately minimal. The major ones, with rationale:

- **`@modelcontextprotocol/sdk`** — MCP wire protocol implementation. Required.
- **`@anthropic-ai/sdk`** — for the rare path where the server calls Claude directly (e.g., `repair-agent.ts` summarization). Most workflow operations don't talk to Claude; the agent does.
- **`bun`** runtime — chosen over Node because Bun's startup time is ~2x faster, which matters because the MCP server boots on every Claude Code session. Bun's built-in TypeScript and SQLite support also remove dependencies that would otherwise need explicit polyfills.
- **`yaml`** — frontmatter parsing. The MCP server reads markdown frontmatter on every tick; a fast, correct YAML parser is non-negotiable.
- **`zod`** — runtime schema validation. Used to validate MCP tool inputs and frontmatter shapes.
- **`localtunnel`** — for `HAIKU_REMOTE_REVIEW=1`. Optional; gates a feature flag.
- **`@sentry/node`** — error reporting. Off by default, opt-in via env var.
- **`uuid`** — session ID generation.
- **`chokidar`** — *NOT used*. Notably absent. The decision to NOT add a file-watcher dependency is load-bearing: the architecture depends on tick-as-reconciliation (§3.3), and adding chokidar would invite the daemon model that this repo deliberately avoids.

### 4.2 External Dependencies (`website/`)

- **Next.js 15** with App Router. Static generation by default; dynamic routes for the review SPA.
- **Tailwind CSS 4** with `@tailwindcss/typography`.
- **Mermaid** for the auto-generated state diagrams. Diagrams are pre-rendered to SVG at build time.
- **Sentry** with the `@sentry/nextjs` integration.

### 4.3 Internal Dependency Direction

The dependency rules (enforced by review):

- `plugin/` MAY reference MCP tool names but MUST NOT import server code. The plugin is markdown + shell + JSON; it ships separately and binds to the MCP tool surface, not the server's TypeScript internals.
- `website/` MAY reference MCP tool names and may render content from `plugin/studios/` (via `_build-prototype-content.mjs`). It MUST NOT import server code; the review SPA talks to the MCP server's HTTP module over the wire.
- `packages/haiku/src/orchestrator/workflow/` MAY import from `state-tools.ts`, `state/shared.ts`, and other workflow-internal modules. It MUST NOT import from `http/` (the HTTP module is a downstream consumer of orchestrator state, not the other way around).
- `packages/haiku/src/hooks/` MAY import shared utilities from `state-tools.ts` and `state/shared.ts`. Hooks MUST be defensive: a crash inside a hook must not crash the harness, so hook entry points wrap their bodies in try-catch and emit a non-blocking error log on failure.
- `packages/haiku/src/http/` is a downstream consumer of everything else. It reads orchestrator state and serves it; nothing imports back into `http/`.

### 4.4 New Dependencies for Drift Detection

The drift-detection subsystem adds *no new external dependencies*. The implementation uses:

- Node/Bun's built-in `crypto.createHash('sha256')` for content hashing.
- Node/Bun's built-in `fs/promises` for file enumeration and reading.
- The existing `yaml` parser for any frontmatter the gate needs to read on tracked surfaces.
- The existing `zod` schemas for validating drift-event payloads at the action boundary.

The decision to add no new dependencies is deliberate. The drift subsystem is load-bearing on every tick; introducing a third-party library here would couple every tick to that library's reliability and performance. SHA computation and directory walking are well-understood primitives that don't need framework abstraction.

---

## 5. Architectural Decisions

This section records the non-obvious choices and their rationale. The format is "why X over Y" rather than "what X does." For *what* the drift subsystem does, see `stages/design/artifacts/ARCHITECTURE.md`.

### 5.1 SHA-256 Baseline Stored as Per-Stage JSON, Not Per-Intent SQLite

**Choice:** The drift baseline is one JSON file per stage at `stages/{stage}/baseline.json`. The format is keyed by intent-relative path → record (sha, author_class, last_updated_tick).

**Alternative considered:** A single per-intent SQLite database holding all stages' baselines, plus a separate table for pending-assessment markers, plus the audit log. SQLite would give us indexed lookups, transactional updates, and atomic multi-stage writes.

**Why not SQLite:** Three reasons. (1) The MCP server already reads `state.json` per stage on every tick; a sibling JSON file in the same directory has zero new I/O overhead. (2) JSON files are diffable in code review and visible in git history; an SQLite blob is opaque. (3) The per-stage scoping aligns with how the gate operates — it processes one stage at a time, so per-stage files match the access pattern. The cost of duplicate path strings across stages (a file under `stages/design/artifacts/` referenced in design's `baseline.json` only) is negligible at the scale of an intent.

**Cost accepted:** A baseline read on tick start touches O(stages) files. For typical intents (3–5 stages), this is fine. If intents grow to dozens of stages, this decision should be revisited.

### 5.2 Pending-Assessment Markers Are Intent-Scoped, Not Stage-Scoped

**Choice:** `drift-markers.json` lives at the intent root, not at `stages/{stage}/`.

**Alternative considered:** Per-stage marker files, mirroring the baseline layout.

**Why intent-scoped:** A drift event on a design-stage artifact may be classified while the active stage is development. The marker would need to be read by the development-stage tick (because it suppresses the drift event on that file) but live in the design-stage directory. Cross-stage file access on every tick is doable, but the ergonomics of "read all markers at once" is cleaner with a single intent-scoped file. The marker store is small (typically zero entries; bounded by the number of in-flight non-terminal classifications).

### 5.3 The Drift Gate Is a Pre-Tick Gate, Not a Per-State Handler

**Choice:** Drift detection runs in `runWorkflowTick` between feedback triage and per-state dispatch. It is not implemented as a workflow state with a handler under `handlers/`.

**Alternative considered:** Add a `drift_check` workflow state that the engine transitions into when drift is detected, then transitions out of when classification completes.

**Why pre-tick:** The pre-tick gates (tamper, feedback triage, drift) all share a common shape: they observe disk state, decide whether the tick can advance to per-state dispatch, and either short-circuit with their own action or pass through. They are *read-most* operations. A workflow state is a *position* the intent sits in; drift detection is not a position, it is a check.

The compositional rule: pre-tick gates compose linearly (each can short-circuit; each runs in a fixed order). Workflow states compose through transitions, which is heavier machinery than this needs. Adding drift detection as a pre-tick gate keeps the state machine simple — the existing per-state handlers do not need to know about drift; only the tick driver does.

### 5.4 `haiku_human_write` Does Not Update the Baseline; the Next Tick Does

**Choice:** When the agent calls `haiku_human_write` (the conversational human-attributed-write MCP tool), the tool writes the file to disk and stamps an action-log entry. It does **not** update `baseline.json`. The next pre-tick drift gate observes the SHA divergence, emits a drift event, and dispatches `manual_change_assessment`, which is what causes the baseline to update.

**Alternative considered:** Have `haiku_human_write` update the baseline directly (since the call carries the human's attribution intent unambiguously), skipping the assessment dispatch.

**Why defer to the next tick:** Three reasons. (1) **Symmetry.** SPA uploads also defer to the next tick (they cannot synchronously update the baseline because the upload endpoint is in `http/` and the baseline is the workflow engine's territory). Having both human-mediated paths (chat tool + browser upload) flow through the same detection-and-classification pipeline removes a special case. (2) **Audit trail completeness.** The assessment record is the durable user-facing surface. Every human-mediated write creating an assessment record means the SPA's drift-history view is complete; users can see what the agent decided about every human edit. Skipping the assessment for `haiku_human_write` would create an audit gap. (3) **Classification still matters.** Even when the human's attribution is unambiguous, the agent should still produce a classification (typically `inline-fix`) so the next bolt knows to re-read the file and treat it as ground truth.

The cost is one extra tick of latency for human-attributed writes to reach baseline equilibrium, which is acceptable.

### 5.5 The Tracked Surface Excludes Files Outside `.haiku/`

**Choice:** The drift-detection tracked surface is intent-scoped. Source code, configs, test fixtures, and other files outside `.haiku/intents/{slug}/` are not baselined and not monitored.

**Alternative considered:** Track the entire repository (or at least everything under `packages/`, `plugin/`, `website/`).

**Why intent-scoped only:** The drift-detection feature exists to catch human edits to *intent-associated* artifacts (knowledge, stage outputs, design briefs, etc.). Tracking source code would conflate "human edited the design brief" with "human is in the middle of writing a feature." The existing git workflow already covers source-code drift detection (commits, PRs, diffs); the drift subsystem fills the gap that git does not — pre-commit, pre-tick observation of human edits to lifecycle artifacts.

This boundary may be widened in a future intent. For now, the boundary is `.haiku/intents/{slug}/**` minus the workflow-managed file set, minus the drift subsystem's own state files.

### 5.6 Eventual Consistency, Not Locking

**Choice:** No file locks, no transactional multi-file writes, no optimistic-concurrency retries. The next tick reconciles whatever state is on disk.

**Alternative considered:** Add a per-intent advisory lock (file-based or in-memory) that blocks ticks while the agent is mid-bolt and blocks human writes (in the SPA path) while a tick is running.

**Why eventual consistency:** Locking introduces deadlock risk. The agent is mid-bolt for an extended period (potentially minutes); blocking human writes during that window converts a UX feature ("humans can edit anything any time") into a UX regression ("humans must wait for the agent"). The eventual-consistency model accepts that mid-bolt partial state may be observed by the next tick — the agent's classification rationale field exists precisely to surface ambiguity in those cases ("human edit appears to target the pre-bolt version; current bolt has partially rewritten this section").

The tick is the reconciliation unit. This is the same shape as event-sourced systems with at-most-once delivery and replay-from-disk; it is well-understood and tractable.

### 5.7 The Kill-Switch Is Plugin-Wide, Not Per-Intent

**Choice:** The `drift_detection: false` flag in plugin settings is a single boolean that disables the gate for every intent in the project. There is no per-intent override.

**Alternative considered:** Add a per-intent setting in `intent.md` frontmatter so users can disable drift detection for a specific noisy intent.

**Why plugin-wide only for v1:** The flag exists for two scenarios (rollout staging and incident response), and both are operator-level concerns, not user-level concerns. A per-intent flag would invite premature use ("this intent has too many drift events; disable it") that papers over real classification bugs rather than fixing them. If the use case for per-intent suppression emerges in production, it can be added in a follow-up. For v1, the simplicity of one global flag with operator-level semantics is the right cost/benefit.

### 5.8 The Audit Log Is JSONL, Not Structured DB

**Choice:** `write-audit.jsonl` is a newline-delimited JSON file, append-only, one record per `haiku_human_write` invocation.

**Alternative considered:** A SQLite table or a structured file with indexed lookups.

**Why JSONL:** The audit log's primary consumers are (a) human security reviewers who read it directly with `jq`, `cat`, or a text viewer, and (b) the assessment classifier, which needs a single recent record to attach context to a drift event. Indexed lookups are not required. The append-only constraint makes JSONL ideal — every write is `O(1)` and crash-safe under POSIX append semantics.

### 5.9 The Architecture-Map Prototype Is Source-of-Truth-Adjacent

**Choice:** The website's `/studios/[slug]/architecture` page (the interactive runtime-architecture map) is rendered from hand-maintained data files in `_data/`. It is *not* auto-generated from the orchestrator code.

**Alternative considered:** Generate the architecture map directly from `orchestrator/actions.ts`, `orchestrator/workflow/handlers/`, and the studio definitions, the same way Mermaid `stateDiagram-v2` files are auto-generated.

**Why hand-maintained:** The map shows *runtime* architecture — actors (User, Agent, Orchestrator, Hooks, SPA), payloads at each transition, hook firings, modal contracts. This is a different shape than the structural state graph the Mermaid diagrams capture. The runtime architecture has implicit dependencies (a payload's shape depends on which action emitted it; an actor's notes depend on the tools they expose) that are not statically extractable from the state machine.

The cost is that the map can drift from the orchestrator. The mitigation is the `architecture-prototype-sync.md` rule: every change to a workflow action, MCP tool, hook, or payload requires a corresponding update to the relevant `_data/` file. Reviewers check this manually. The Mermaid diagrams *are* auto-generated and serve as the structural ground truth; the map adds human-shaped runtime narrative on top.

### 5.10 No New File-Watcher Dependency

**Choice:** Drift detection runs only at tick boundaries. There is no `chokidar`, no `fs.watch`, no inotify subscription.

**Alternative considered:** Add a file-watcher inside the MCP server that emits drift events in real time, allowing the SPA to show drift-detected indicators without waiting for the next tick.

**Why not:** A file-watcher introduces a persistent process with its own failure modes (watch handle leaks, missed events under high churn, OS-specific behavior on macOS vs. Linux). The MCP server today is request-response — it boots when Claude Code asks, handles requests, and exits when the session ends. Adding a watcher inverts this model and creates a class of bugs we do not have today.

The user-visible cost is that drift indicators appear after the next tick, not in real time. The mitigation is that ticks are typically frequent during active work (every hat advance, every feedback action, every gate progression drives a tick). The "manual change pending" chip on the affected SPA artifact card carries the user through the assessment-window UX.

---

## 6. Path-Naming Reconciliation: `outputs/` vs `artifacts/`

There is a known historical inconsistency between two directory names for stage-produced deliverables:

- `stages/{stage}/outputs/` — appears in some older studio definitions and in DESIGN-BRIEF.md sketches.
- `stages/{stage}/artifacts/` — the canonical name across the software studio's STAGE.md `outputs:` declarations.

**Decision (binding for this codebase):** `artifacts/` is the canonical name. Anywhere a document or sketch references `outputs/`, the implementation MUST treat it as an alias for `artifacts/`. Do not create a separate `outputs/` directory; do not ship code that special-cases `outputs/` as distinct from `artifacts/`.

This decision was made in the design stage of this intent (TRACKED-SURFACE-BOUNDARY.md "Canonical Directory Name" section) and is preserved here so future readers do not re-litigate it. Both names appear in the tracked surface; the gate normalizes them on read.

---

## 7. New Module: The Drift-Detection Subsystem

This intent introduces a new subsystem within `packages/haiku/src/orchestrator/workflow/`. The shape:

```
packages/haiku/src/orchestrator/workflow/
├── drift-detection-gate.ts       # NEW: pre-tick gate. Mirror of feedback-triage-gate.ts
│                                 #      in shape (read disk, decide, return action).
├── drift-baseline.ts             # NEW: baseline.json read/write, SHA computation,
│                                 #      tracked-surface enumeration.
├── drift-markers.ts              # NEW: drift-markers.json read/write, marker lifecycle
│                                 #      (write, suppress, clear on resolution).
├── handlers/
│   └── manual-change-assessment.ts  # NEW: handler for the manual_change_assessment
│                                     #      action (emits the dispatch payload).
├── feedback-triage-gate.ts       # Existing — runs before drift gate.
├── pre-tick.ts                   # Existing — runs before all gates (consistency repair).
├── run-tick.ts                   # MODIFIED: adds drift gate to the pre-tick chain.
└── ...
```

The siblings in `packages/haiku/src/`:

```
packages/haiku/src/
├── tools/orchestrator/
│   ├── haiku_human_write.ts      # NEW: MCP tool for conversational human writes.
│   └── haiku_classify_drift.ts   # NEW: MCP tool the agent calls to record outcomes
│                                 #      from manual_change_assessment.
├── http/
│   └── upload-routes.ts          # NEW (or extension): SPA upload endpoint that
│                                 #      mirrors haiku_human_write semantics.
├── hooks/
│   └── (no changes — drift detection deliberately does NOT add a hook;
│         agents write directly to tracked-surface paths and the gate observes
│         on next tick. The hook-bypass-becomes-a-liability risk identified
│         in DISCOVERY.md is mitigated by the trust+audit stance, not by hooks.)
└── ...
```

The dependency direction within the subsystem:

```
run-tick.ts                  ──→  drift-detection-gate.ts
                                     │
                                     ├──→  drift-baseline.ts
                                     ├──→  drift-markers.ts
                                     └──→  state/shared.ts (findHaikuRoot, intentDir)

handlers/manual-change-assessment.ts ──→  drift-baseline.ts (payload assembly)
                                     ──→  state/shared.ts

tools/orchestrator/haiku_human_write.ts ──→  state-tools.ts (path resolution,
                                              tracked-surface validation)
                                          ──→  drift-baseline.ts (action-log write)
                                          ──→  (writes write-audit.jsonl directly)

tools/orchestrator/haiku_classify_drift.ts ──→  drift-markers.ts
                                            ──→  drift-baseline.ts (terminal-outcome update)
                                            ──→  haiku_feedback (for surface-as-feedback outcomes)
                                            ──→  revisit (for trigger-revisit outcomes)
```

Three integration points in existing code:

1. **`run-tick.ts`** — adds the drift gate to the pre-tick chain after feedback triage. The action-mapping switch grows by one entry (`manual_change_assessment`).
2. **`orchestrator/actions.ts`** — adds `manual_change_assessment` to the discriminated union and the prompt-scaffolding registry.
3. **`tools/orchestrator/index.ts`** — registers `haiku_human_write` and `haiku_classify_drift` in the tool registry.

The architecture-prototype map (in `website/app/studios/[slug]/architecture/_data/`) and the Mermaid `stateDiagram-v2` regeneration are downstream sync surfaces, not dependencies of the subsystem itself.

---

## 8. Sync Surfaces

When the drift-detection subsystem ships, the following surfaces must move together (per the matrix in the root `CLAUDE.md` and `.claude/rules/sync-check.md`):

| Surface | What changes |
|---|---|
| Paper (`website/content/papers/haiku-method.md`) | New section in Quality Enforcement describing the pre-tick drift gate. Extension of Lifecycle / Persistence section noting `baseline.json` and `drift-markers.json` as workflow-engine state. New concept: `manual_change_assessment` action and the four-outcome taxonomy. |
| Plugin studios | No new studio. The `software` studio's `development/STAGE.md` may reference the new MCP tools in hat instructions if the tools are useful to specific hats. |
| Plugin schemas/providers | No changes. |
| Plugin hooks | No new hooks (deliberate — see §7). The `guard-workflow-fields` hook's deny-list does not change; the new drift-subsystem files (`baseline.json`, `drift-markers.json`, `write-audit.jsonl`, `drift-assessments/*`) are not in the hook's allowed-write zone for agents. The `haiku_human_write` MCP tool is the sanctioned write path for human-attributed writes; its allow/deny list is enforced inside the tool itself, not via the hook. |
| MCP server | New module under `orchestrator/workflow/` (drift gate + baseline + markers). New handler (`manual_change_assessment`). Two new MCP tools (`haiku_human_write`, `haiku_classify_drift`). One new HTTP endpoint (SPA upload). Modifications to `run-tick.ts`, `orchestrator/actions.ts`, `tools/orchestrator/index.ts`. |
| Website docs | New page (or section) explaining drift detection to users. Glossary entries for `manual_change_assessment` and the author-class taxonomy. |
| Website architecture map | New action node (`manual_change_assessment`) in `_data/payload-for.ts`. New transitions on the gate handler. New actor notes on the orchestrator describing pre-tick drift behavior. New SPA actor notes on the upload endpoint. |
| Website Mermaid diagrams | Auto-regenerated via `bun run --cwd packages/haiku export:workflow-diagrams`. Verify post-regeneration that the new pre-tick branch appears for every studio. |
| CHANGELOG | One entry under "Added" for the drift-detection subsystem. (The CHANGELOG is CI-managed; the entry is generated from PR titles, not hand-edited.) |

The sync discipline is enforced by review. A PR that changes the MCP server's drift behavior without a corresponding paper update is rejected; a paper change without a corresponding plugin update is rejected.

---

## 9. Open Questions for Future Intents

These are items the current intent does not resolve. They are documented here so a future intent can pick them up with full context:

- **Per-intent kill-switch.** The current kill-switch is plugin-wide. If a user has one noisy intent, they cannot disable drift detection for just that intent without affecting others. A per-intent flag on `intent.md` frontmatter would fix this; deferring to v2 is the choice today (§5.7).
- **Real-time SPA drift indicators.** Drift is detected only at tick boundaries. A SPA WebSocket push from the upload endpoint to the active session (saying "your upload landed; classification will fire on the next tick") could close the small UX gap between upload and assessment. The chip lifecycle in the design specs handles this passively today.
- **Audit-log rotation.** `write-audit.jsonl` grows indefinitely. For long-running intents with many human writes, log rotation is a future concern (§8 of `MCP-TOOL-CONTRACT.md`). Not in scope for v1.
- **Tracked-surface widening.** The boundary is `.haiku/intents/{slug}/**` minus exclusions. A future intent may widen this to track human edits to `plugin/studios/` (so studio definition changes are caught by the same mechanism). Today, studio changes go through git review only.
- **Auto-throttling of drift events.** Rapid sequential edits (a designer iterating on a layout, saving every few seconds) could fire one assessment per tick. Coalescing within a tick is a future optimization. The agent's classification rationale field can absorb the noise today (the agent can note "multiple iterative edits; the latest is the intended ground truth").
- **Multi-user concurrent edits.** The current model assumes one human at a time. If two users edit the same file between ticks, the second write wins on disk and the first is lost (silently). A multi-user surface would need conflict resolution, which is out of scope for v1.

---

## 10. References

- `CLAUDE.md` (root) — sync-discipline matrix, terminology table, key file locations.
- `.claude/rules/sync-check.md` — when to verify cross-component consistency.
- `.claude/rules/architecture-prototype-sync.md` — when to update the runtime architecture map and the auto-generated Mermaid diagrams.
- `plugin/studios/ARCHITECTURE.md` — canonical structural rules for studios, stages, hats, feedback. More authoritative than this document for studio shape.
- `stages/design/artifacts/ARCHITECTURE.md` — design-stage architecture spec for the drift-detection feature. More authoritative than this document for drift-subsystem behavioral contract.
- `stages/design/artifacts/MCP-TOOL-CONTRACT.md` — `haiku_human_write` tool contract.
- `stages/design/artifacts/TRACKED-SURFACE-BOUNDARY.md` — exact path patterns for the tracked surface.
- `stages/design/artifacts/ROLLOUT-AND-BASELINE-ESTABLISHMENT.md` — first-tick semantics and the kill-switch flag.
- `stages/design/artifacts/SPA-UI-SPECS.md` — the three new SPA surfaces (Knowledge Upload Panel, Stage Output Replacement Affordance, Drift-Detected Indicator).
- `knowledge/DESIGN-DECISIONS.md` — the nine inception-stage decisions this architecture honors.
- `knowledge/IMPLEMENTATION-MAP.md` — paper / plugin / website change-surface map at section granularity.
- `knowledge/DISCOVERY.md` — original problem framing, risk catalog, capability needs.

---

## Maintenance

**Boundary for updates:** This document is updated when development introduces new patterns, changes existing module boundaries, adds external dependencies, or makes architectural decisions that future readers will want to understand.

It is *not* updated for routine implementation changes (new hats, new review agents, new units within an existing studio, new MCP tools that fit the existing resource-tool pattern). Those changes flow through the studio markdown definitions and, where relevant, the architecture-map data files.

**Conflict resolution:** When this document and a more-specific document (e.g., `plugin/studios/ARCHITECTURE.md`, the design-stage architecture spec) disagree, the more-specific document is authoritative for its scope. This document holds the cross-cutting view: how the pieces fit together at the repository level and why those boundaries are where they are.

**Currency:** Outdated sections are updated or removed in the same PR that makes them outdated. Stale architecture documentation is worse than no architecture documentation.

---

## Annex: Upstream-Reconciliation Pre-Tick Gate (Co-Located, Not Derived from This Intent)

The action surface in §2.3 lists `manual_change_assessment` as the only NEW action attributable to this intent. A second new action — `upstream_reconciliation_required` — also exists in the discriminated union as of this branch. It belongs to a separate subsystem co-located on this intent's branch via the 2026-05-01 main-merge (origin: repo PR #283 "feat(orchestrator): file-based dispatch + reconciliation + unit-write validation", merged 2026-04-30).

**Action surface, including the co-located subsystem:**

```
"upstream_reconciliation_required"   # NOT FROM THIS INTENT — pre-tick reconciliation gate
                                     #   dispatched when corpus fingerprint detects
                                     #   cross-document divergence (tool-name,
                                     #   http-status, field-name) between agent-authored
                                     #   upstream artifacts. Implementation:
                                     #   packages/haiku/src/orchestrator/workflow/
                                     #     upstream-reconciliation.ts
                                     #   Wiring: packages/haiku/src/orchestrator/workflow/
                                     #     run-tick.ts
                                     #   Resolution path: agent reconciles upstream
                                     #     artifacts and re-ticks, OR calls
                                     #     `haiku_reconciliation_acknowledge`.
```

**MCP tool surface, including the co-located subsystem:**

The `haiku_reconciliation_acknowledge` MCP tool (acknowledge an intentional divergence and proceed) is also part of the co-located subsystem. It is referenced by the operations runbook (`stages/operations/units/unit-01-operational-runbook.md` scenarios 5 and 11). It is NOT a tool this intent's design or development specified.

**Pre-tick gate chain, including the co-located subsystem:**

The pre-tick gate chain on this branch is:

```
tamper-detection → feedback-triage → drift-detection → upstream-reconciliation → per-state dispatch
```

The drift-detection gate (this intent) and the upstream-reconciliation gate (the co-located subsystem) are **independent pre-tick gates** with disjoint scopes:

| Gate | Detects | Triggers Action |
|---|---|---|
| drift-detection (this intent) | Human writes to tracked-surface files (per-file SHA mismatch vs `baseline.json`) | `manual_change_assessment` |
| upstream-reconciliation (co-located subsystem) | Cross-document divergence between agent-authored upstream artifacts (corpus fingerprint mismatch) | `upstream_reconciliation_required` |

The two gates do not share state, do not interact, and target different scope classes. The drift-detection gate consumes `baseline.json`; the reconciliation gate consumes a `corpus_fingerprint` value persisted in per-stage `state.json`. The two persistence channels are independent.

**Why this annex exists rather than full integration:** Bringing the reconciliation gate into the architecture proper (assigning it section numbers in §2-§7, adding rows to §3.1's category table, editing the §1 module map's responsibilities) would require this intent to take design ownership of a subsystem its inception did not propose. The reconciler-style honest answer is to acknowledge the gate's presence on the branch and point at its source, leaving full architectural integration to a future intent that explicitly takes ownership of reconciliation.

**Cross-references:** See `knowledge/DISCOVERY.md` § "Annexed Subsystem", `knowledge/DESIGN-DECISIONS.md` Annex A, `knowledge/IMPLEMENTATION-MAP.md` § "Annex: Out-of-Scope Subsystem", and `stages/design/artifacts/ARCHITECTURE.md` § "Annex: Co-Located Upstream-Reconciliation Gate".
