---
title: Design decisions
model: sonnet
depends_on:
  - unit-01-discovery-document
inputs: >-
  ["stages/inception/artifacts/DISCOVERY.md",
  "knowledge/CONVERSATION-CONTEXT.md"]
outputs:
  - >-
    .haiku/intents/out-of-band-human-file-modifications/knowledge/DESIGN-DECISIONS.md
status: completed
bolt: 1
hat: verifier
started_at: '2026-04-28T14:19:34Z'
hat_started_at: '2026-04-28T14:24:34Z'
iterations:
  - hat: researcher
    started_at: '2026-04-28T14:19:34Z'
    completed_at: '2026-04-28T14:23:49Z'
    result: advance
  - hat: distiller
    started_at: '2026-04-28T14:23:49Z'
    completed_at: '2026-04-28T14:24:34Z'
    result: advance
  - hat: verifier
    started_at: '2026-04-28T14:24:34Z'
    completed_at: '2026-04-28T14:25:11Z'
    result: advance
completed_at: '2026-04-28T14:25:11Z'
---
# Design Decisions

Distill the architectural decisions reached in the elaboration Q&A (recorded authoritatively in `stages/inception/decision_log.json`) and the discovery research into a structured DESIGN-DECISIONS.md. This is the inception-stage record of "what was decided before design started" — the design stage consumes it as authoritative input rather than re-litigating these choices. Each decision states the alternatives considered, the chosen path, and the rationale. The document records the decision; it does not specify the implementation that follows from it. Naming things like a working action name (e.g. `manual_change_assessment`) is acceptable as a *working label* the design stage may refine — but the document's authority lies in the choices made, not in any specific naming.

## Scope

The DESIGN-DECISIONS.md must capture, at minimum, decisions across these axes (each axis maps 1:1 to an entry in `decision_log.json`; if any axis is absent from the decision log, surface it as an open question rather than inventing a position):

- **Detection model** — explicit (UI / dedicated tool / agent-writes-on-user-instruction) AND implicit (per-stage hash baseline diffed by a pre-tick gate). Both modes are required because silent filesystem drops must be caught with no announcement.
- **Edit-surface boundary** — workflow-managed files (units, feedback, intent.md, state.json) remain MCP-only at the agent level via the existing agent-level guardrail; humans editing via SPA / review-app / direct filesystem are out-of-band and not policed by the agent guardrail.
- **Reaction mechanism** — a new first-class workflow concept (working name `manual_change_assessment`) is introduced, distinct from feedback-triage. The agent classifies the diff into outcomes covering ignore, inline-fix, surface-as-feedback, and trigger-revisit. Specific action naming and outcome taxonomy are open for the design stage to refine; what is settled is that this is a new mechanism, not a piggyback on feedback-triage.
- **Concurrency model** — eventual consistency. No locking. The next `haiku_run_next` tick's pre-tick gate observes drift and reacts. Mid-bolt concurrency is acceptable; the agent's mid-bolt work may be partially based on the pre-edit version, and the next tick reconciles.
- **Cascade policy** — when drift is detected on a stage earlier than the active stage, the classification step decides whether to trigger a revisit or surface as feedback; the agent owns the decision, not the harness.
- **Three change-type coverage** — designer replaces output, product owner does small edit + asks AI to extend, user uploads knowledge. All three in scope for v1; all three resolve through the same drift-reaction mechanism with different agent classifications.
- **UX surface composition** — SPA upload UI + manual filesystem drops + agent-writes-knowledge-on-user-instruction (a sanctioned MCP write). All three paths feed the same detection model; the implicit baseline gate is the unifier.
- **Sync surface scope** — full three-component change: paper (new lifecycle concept), plugin (baselines, gate, action, tool, SPA upload), website (docs).
- **Human-write path integrity** — open question: how does the system ensure the sanctioned "agent writes on behalf of human" MCP tool and SPA upload path cannot be invoked by an agent without explicit human instruction. This is a strategic security boundary the design stage must answer; the inception record names the question and references the "hook bypass becomes a liability" risk in DISCOVERY.md.

For each decision, the document records:

- The decision itself (one or two sentences) — drawn from the decision_log entry verbatim where available
- The alternatives that were considered and rejected — drawn from the decision_log `options` field
- The rationale citing the specific risk or capability the decision addresses, with a section anchor or quoted phrase from DISCOVERY.md

## Completion Criteria

- DESIGN-DECISIONS.md exists at `.haiku/intents/out-of-band-human-file-modifications/knowledge/DESIGN-DECISIONS.md` and is at least 4KB of substantive prose
- Document captures one section per decision axis listed in the Scope above (≥9 axes), and every entry in `stages/inception/decision_log.json` is reflected in the document — no recorded decision is silently dropped
- Each decision section names the chosen path (or "open for design" for the human-write-path-integrity axis), lists ≥1 rejected alternative with a one-line reason, and a rationale citing either a specific risk from DISCOVERY.md or a specific capability need
- Document references DISCOVERY.md for each major risk/capability cited, with a section anchor or quoted phrase — no naked claims
- Document does NOT specify file paths under `packages/haiku/src/`, MCP tool method names, JSON schemas, database column names, or shell commands — those are design-stage artifacts. Working labels (e.g. an action name like `manual_change_assessment` carried over from the elaboration Q&A) are permitted as design-stage hints, not as specifications
- Document addresses how the system reacts to detected drift at a behavioral level (when each classification outcome fires, what the agent does in each case), referencing the working classification taxonomy from the decision log without binding to specific frontmatter shapes or method signatures
- Document records the eventual-consistency model and explicitly acknowledges that mid-bolt concurrency may produce partial-state work
- Document explicitly surfaces the human-write-path-integrity question as open, naming both candidate stances ("trust + audit" vs "explicit human confirmation required") so the design stage has the framing
- Document ends with an "Open for design" section listing decisions deliberately deferred to design (e.g., specific tracked-surface boundary, exact storage location of baselines, baseline-establishment-on-upgrade behavior, human-write path integrity stance)
