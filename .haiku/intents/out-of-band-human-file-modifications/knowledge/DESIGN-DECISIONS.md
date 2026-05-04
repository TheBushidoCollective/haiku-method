# Design Decisions — Out-of-band Human File Modifications

This document records the architectural decisions reached through the elaboration Q&A captured in `knowledge/CONVERSATION-CONTEXT.md` and the discovery research in `stages/inception/artifacts/DISCOVERY.md`. It is the inception-stage record of "what was decided before design started." The design stage consumes this as authoritative input and does not re-litigate these choices.

Each entry names the decision, the alternatives that were considered and rejected, and the rationale citing the specific risk or capability need from DISCOVERY.md that drove the choice. Working labels (e.g. `manual_change_assessment`) are carried forward as design-stage hints, not specifications — the design stage owns the final naming and taxonomy.

---

## Decision 1: Detection Model

**Chosen path:** Both explicit detection (human-announced writes via SPA upload UI or a sanctioned MCP tool) AND implicit detection (per-stage SHA baseline diffed by a pre-tick gate on every `haiku_run_next` tick) are required. Both modes are active simultaneously.

**Alternatives rejected:**

- *Explicit-only detection* — The system could rely on the human announcing every write through the SPA upload UI or by invoking a dedicated tool. Rejected because it fails silently for filesystem drops: a designer who drops a PNG into the stage output directory, or a PO who edits a file outside the SPA, would be invisible to the system. DISCOVERY.md § "Capability needs: Per-tick diff detection" notes that the system "can't rely on the human announcing themselves."
- *Polling / file-watch real-time detection* — The system could maintain a background file-watcher and emit events as writes happen. Rejected as architectural overreach for v1: it introduces a persistent daemon dependency, conflicts with the event-driven tick model, and would need to handle the locked-worktree boundary described in DISCOVERY.md § "Interaction with locked worktrees and parked branches." On-tick detection is sufficient.
- *Git-history-only detection* — The system could walk git log on each tick and compare author identity. Rejected because the implicit-detection model needs to work before the human commits. A file dropped into the worktree before `git add` would be invisible to a git-history approach.

**Rationale:** DISCOVERY.md § "Feature goal & vision" states the detection "has to cover all three [write paths]; the system can't rely on the human announcing themselves." Implicit baseline-and-diff is the unifier. The competitive landscape (§ "Gaps and opportunities: Silent filesystem drops are universally underserved") shows no competitor handles silent drops — this dual model is the differentiator.

---

## Decision 2: Edit-Surface Boundary

**Chosen path:** The existing agent-level guardrail (PreToolUse hook) remains unchanged and continues to apply exclusively to agent writes. Workflow-managed files (units, feedback, intent.md, state.json) remain MCP-only for agents. Humans editing via the SPA, the review app, or direct filesystem are out-of-band by definition and are not governed by the agent guardrail. The guardrail boundary is: "agents must use MCP; humans can write anything."

**Alternatives rejected:**

- *Extend the PreToolUse hook to cover human writes* — The hook could intercept filesystem writes from any process, not just the agent. Rejected because the hook sits in Claude Code's tool-use pipeline and has no visibility into out-of-agent writes. Implementing this would require OS-level file-watch plumbing (inotify, FSEvents) that goes well beyond the hook architecture. DISCOVERY.md § "Cross-cutting boundary with workflow-managed-file hook policy" notes this as a boundary to a separate security artifact, not this intent.
- *Prevent humans from writing to stage-output directories entirely* — The system could chmod or git-lock stage output directories between agent sessions. Rejected because it directly contradicts the feature goal: "humans regain control over their own work product without breaking out of the lifecycle" (DISCOVERY.md § "Feature goal & vision").

**Rationale:** The Q&A in CONVERSATION-CONTEXT.md explicitly decided "SPA and review-app edits bypass workflow hooks because they're out-of-band human actions, not agent writes — hooks remain the boundary for agents only." This keeps the existing security guarantee intact while adding a parallel detection layer. The risk noted in DISCOVERY.md § "Hook bypass becomes a liability" — that an agent might pose as a human — is a design-stage security concern, not a reason to tighten the boundary in a way that blocks legitimate human writes.

---

## Decision 3: Reaction Mechanism

**Chosen path:** A new first-class workflow concept is introduced — working name `manual_change_assessment` — that is distinct from feedback-triage. When drift is detected on the pre-tick gate, the workflow emits this action and the agent classifies the diff into one of four outcome categories: ignore, inline-fix, surface-as-feedback, or trigger-revisit. The agent owns the classification decision, not the harness. The specific action naming and outcome taxonomy are deliberately open for the design stage to refine.

**Alternatives rejected:**

- *Piggyback onto the existing feedback-triage gate* — Drift could be surfaced as a form of open feedback, processed through the existing `feedback_triage` action. Rejected because feedback-triage handles agent-authored findings already in the feedback directory; it has a different lifecycle (triaged_at, relocation across stages, haiku_feedback_move). Mixing human-edit drift into that channel would corrupt its semantics. CONVERSATION-CONTEXT.md records the decision: "A new workflow action handles the response — this is not piggybacked onto FB-triage."
- *Harness-driven classification (no agent judgment)* — The harness could classify drift mechanically: file extension → binary? → always "acknowledge"; size delta < threshold → always "ignore"; etc. Rejected because the classification quality matters deeply. DISCOVERY.md § "Trust erosion if the agent classifies wrong" notes the asymmetric cost: a missed "fundamental redirect" silently drops the human's intent. Mechanical heuristics can't reason about whether a changed HTML mock represents a cosmetic tweak or a complete redesign. Agent judgment is required.
- *Always surface as feedback (no inline-fix or ignore paths)* — Every detected change could unconditionally create a feedback item. Rejected because it would flood the feedback channel with noise (e.g., a PO correcting a typo shouldn't create a formal feedback finding). The four-outcome model lets the agent route low-signal changes silently and reserve the feedback channel for findings that require human attention.

**Rationale:** The differentiator identified in DISCOVERY.md § "Gaps and opportunities: No tool has a classify-and-decide step" — "the agent looks at the diff, asks 'is this a small extension I can fold into the current bolt? a regression that should become feedback? a fundamental redirect that requires going back?' and routes accordingly" — requires a purpose-built action, not a repurposed existing one.

---

## Decision 4: Concurrency Model

**Chosen path:** Eventual consistency. No file locking, no optimistic concurrency tokens, no mid-bolt blocking. The system accepts that if a human edits a file while the agent is mid-bolt, both writes may land in the same git state. The next `haiku_run_next` tick observes drift and reconciles. The agent's mid-bolt work may be partially based on the pre-edit version of the file; this is an acknowledged and accepted condition.

**Alternatives rejected:**

- *File locking during agent bolts* — The system could place a lock on tracked files during agent execution and refuse human writes until the bolt completes. Rejected for two reasons: (1) it directly blocks the human from doing their work, undoing the entire premise of the feature; (2) it requires a locking mechanism that spans the agent's tool-use pipeline, the SPA upload path, and direct filesystem writes — an implementation surface that doesn't exist.
- *Optimistic locking (CAS / version tokens)* — Each write (agent or human) could carry a version token; writes that arrive on a stale version fail with a conflict error. Rejected because the human's filesystem drop has no awareness of version tokens — there's no protocol to attach them to a `cp` command or a drag-and-drop upload.
- *Real-time merge (OT / CRDT)* — Operational-transform or CRDT-style merging at the file level. Rejected as architectural overreach: H·AI·K·U operates on whole-file artifacts, not sub-document operations. DISCOVERY.md § Notion AI's model notes that OT "requires both writers to be actively online and editing the same document simultaneously" — the opposite of H·AI·K·U's async model.

**Rationale:** DISCOVERY.md § "Concurrency vs. agent in-flight writes" names the condition explicitly: "the agent's mid-bolt work may be partially based on the pre-edit version. The conversation context accepts this as eventual consistency." The on-tick reconciliation model is consistent with the rest of the workflow's event-driven design and keeps the implementation surface tractable.

---

## Decision 5: Cascade Policy (Cross-Stage Drift)

**Chosen path:** When drift is detected on a file owned by a stage earlier than the currently active stage, the `manual_change_assessment` classification step decides whether to trigger a revisit or surface the change as feedback. The agent owns the decision. The harness does not automatically trigger revisit on cross-stage drift; it presents the finding and awaits the agent's classification outcome.

**Alternatives rejected:**

- *Automatic revisit on any cross-stage drift* — The harness could detect "this file belongs to stage N but we're on stage N+2" and automatically invoke revisit. Rejected because the severity of the drift determines whether revisit is warranted. A PO correcting a typo in a design artifact shouldn't push the entire intent back to the design stage. Automatic revisit conflates the detection signal with the response, removing the classification step that is the core of the feature.
- *Ignore cross-stage drift entirely* — Only drift on files owned by the current stage triggers assessment; earlier-stage files are not tracked once the stage is complete. Rejected because DISCOVERY.md § "Considerations & Risks: Behavior change for existing intents" and the three motivating scenarios (designer replaces layout, PO edits deliverable) both involve editing files that were produced in an earlier stage. Ignoring cross-stage drift would leave the most common use case unaddressed.
- *Block forward progress until cross-stage drift is resolved* — The harness could prevent advancing to the next tick until every cross-stage drift finding is classified. Rejected because it introduces blocking behavior inconsistent with the eventual-consistency decision (Decision 4) and could stall intents on incidental filesystem changes.

**Rationale:** DISCOVERY.md § "Open questions: How does this interact with revisit?" surfaces this as a live question. The unit spec's scope axis on cascade policy settles it: "the classification step decides whether to trigger a revisit or surface as feedback; the agent owns the decision, not the harness." This maintains agent autonomy and avoids false revisit storms from routine small edits.

---

## Decision 6: Three Change-Type Coverage

**Chosen path:** All three motivating change types are in scope for v1 and all three resolve through the same `manual_change_assessment` drift-reaction mechanism, with different agent classifications producing different outcomes. The three types are: (1) designer replaces a stage output file; (2) product owner makes a small edit and asks the agent to extend; (3) user uploads knowledge into the elaborate phase. They are not handled by separate specialized mechanisms.

**Alternatives rejected:**

- *Scope to knowledge-upload only (type 3)* — The simplest version of the feature would only detect new files added to the knowledge directory and ignore changes to existing stage outputs. Rejected because the motivating examples that originated the intent (CONVERSATION-CONTEXT.md) include all three types, and the PO's "small edit + ask AI to extend" case is the one most likely to cause silent edit loss — the core harm described in DISCOVERY.md § "Silent loss of human edits."
- *Handle type 1 (layout replacement) separately via a dedicated tool* — Designer changes could be handled by a "replace-output" MCP tool that requires the agent to invoke explicitly, bypassing the drift-detection path. Rejected because it requires the designer to know about the MCP tool and invoke it — the exact "human has to fight the framework" pattern described in DISCOVERY.md § "Feature goal & vision."
- *Defer types 1 and 2 to a future phase* — Knowledge upload (type 3) ships in v1; designer/PO edits come later. Rejected by the explicit Q&A decision in CONVERSATION-CONTEXT.md: "All three motivating change types are in scope."

**Rationale:** DISCOVERY.md § "Differentiator summary" states: "The `manual_change_assessment` action is genuinely novel: the agent looks at the diff and asks 'is this a small extension I can fold into the current bolt? a regression that should become feedback? a fundamental redirect that requires going back?'" This framing only makes sense if all three change types flow through the same mechanism. Type-specific handling would fragment the model and reduce the classification task to type dispatch rather than semantic judgment.

---

## Decision 7: UX Surface Composition

**Chosen path:** Three write paths feed the same detection model, unified by the implicit baseline gate. The paths are: (1) SPA upload UI — a deliberate upload affordance in the browse/review SPA for attaching or replacing files per stage; (2) manual filesystem drop — a human places a file directly in the worktree, no tooling involved; (3) agent writes knowledge on user instruction — the agent invokes a sanctioned MCP tool to write a file as a human-class write when the user asks "hey claude write this file for me." All three are detected by the per-tick SHA diff, not by three separate listeners.

**Alternatives rejected:**

- *SPA-as-the-only-sanctioned path (block filesystem drops)* — The system could designate the SPA as the only legitimate human write surface and reject or flag files that appear outside SPA-tracked paths. Rejected because filesystem drops are a real workflow for technical users (designers using local tools, POs editing with their IDE), and blocking them contradicts the design principle of meeting humans where they are.
- *Chat-instruction-only for agent-writes-on-behalf-of-human* — The agent could handle "write this file" requests by using its normal Write tool, indistinguishable from any other agent write. Rejected because it would suppress the diff-detection signal (the baseline would record the file as agent-written, so the next tick's diff would show no drift). A dedicated sanctioned tool is needed to attribute the write correctly, per DISCOVERY.md § "Sanctioned 'agent writes on behalf of human' tool."

**Rationale:** The Q&A (CONVERSATION-CONTEXT.md) explicitly defines the UX surface as "SPA upload UI, manual filesystem drops, and the agent itself writing knowledge files out-of-band on user instruction." The implicit baseline gate is the unifier — it handles all three paths without requiring each path to register its writes with a central controller. DISCOVERY.md § "Capability needs: Per-tick diff detection" describes the unified approach.

---

## Decision 8: Sync Surface Scope

**Chosen path:** Full three-component sync is required: paper (new lifecycle concept and terminology), plugin (baselines, pre-tick gate, new workflow action, sanctioned MCP tool, SPA upload affordance), and website (user-facing docs explaining out-of-band write paths, detection model, eventual-consistency guarantee, classification outcomes).

**Alternatives rejected:**

- *Plugin-only, docs deferred* — Ship the plugin implementation without updating the paper or website. Rejected because the paper is the source of truth for methodology concepts (CLAUDE.md project instructions), and introducing a new pre-tick gate and workflow action without documenting it in the paper leaves the methodology specification out of sync. Every other structural change in the project follows the sync discipline table.
- *Partial website docs* — Update only the implementation reference but not the user-facing methodology docs. Rejected because the out-of-band write paths and eventual-consistency model need to be explained to non-technical users (designers, product owners) who are precisely the intended beneficiaries. DISCOVERY.md § "UI Impact: Documentation pages" identifies this as a required deliverable.

**Rationale:** The sync discipline in the project's CLAUDE.md is explicit: new lifecycle phases and new workflow actions require paper documentation, plugin implementation, and website docs updates in coordination. This is not discretionary. The methodology's credibility depends on the paper accurately describing what the plugin does.

---

## Decision 9: Human-Write-Path Integrity (Open for Design)

**Chosen path (framing only):** This decision is deliberately left open for the design stage. The question is: how does the system ensure that the sanctioned "agent writes on behalf of human" MCP tool and SPA upload path cannot be invoked by an agent without explicit human instruction?

**The two candidate stances the design stage must choose between:**

- **Trust + audit** — The system trusts the agent to use the sanctioned human-write tool only when the user instructed it. Attribution is recorded (the write is logged as human-attributed), and audit trail (git blame, assessment log) provides post-hoc accountability. No active enforcement; integrity is maintained by convention and observable in the record. This is lower friction but accepts the risk that a misconfigured or adversarial agent could classify its own writes as human-attributed.

- **Explicit human confirmation required** — Before the sanctioned human-write tool completes, a confirmation signal is required from the human (e.g., an `ask_user_visual_question` prompt, a UI confirmation in the SPA, or a hook that requires an ambient human-approval token). This closes the agent-impersonation attack vector but adds a confirmation round-trip on every use, which may feel like ceremony for "hey claude just write this config file."

**Rejected alternatives to both stances:**

- *No sanctioned tool at all; agent uses normal Write tool* — Bypasses the problem by removing the path, but also removes the "agent writes knowledge on behalf of human" capability that is explicitly in scope (DISCOVERY.md § "Capability needs: Sanctioned 'agent writes on behalf of human' tool"). Not viable.
- *Block the human-write path for agents in autopilot mode* — Autopilot mode could simply disallow the sanctioned tool. Rejected as too coarse — the most common use case (user in chat says "write this") happens in interactive mode, not autopilot, but the modes can blur.

**Why this is open:** DISCOVERY.md § "Risks: Hook bypass becomes a liability" names this explicitly: "if an agent ever finds a way to pose as a human (writing through the SPA path, calling the human-write MCP tool intentionally), the workflow-managed-file guarantees evaporate. This is a security boundary worth protecting." The design stage must answer this before speccing the MCP tool's implementation. Both stances are legitimate; the choice depends on the threat model the team accepts.

---

## Open for Design

The following decisions were not resolved at inception and are explicitly deferred to the design stage. They are named here so the design stage has the framing, not left as implicit unknowns.

**Tracked-surface boundary** — Which directories and file types constitute the "tracked surface" for SHA baselining? Stage output directories and knowledge directories are clearly in. Files outside `.haiku/` that the agent touches during execution (source code, configs, test fixtures) are less clear. Design must draw this boundary explicitly. DISCOVERY.md § "Open questions: Which files are part of the tracked surface?" frames the decision space.

**Baseline storage location** — Where does the per-stage SHA baseline live? It must be readable on every tick without additional I/O overhead and must survive branch switches and worktree operations. Design must choose a storage location (inline in state.json, a sidecar file, a git ref). The location affects the locking model and the upgrade path.

**Baseline establishment on upgrade** — What happens to existing intents on the first tick after the feature ships? DISCOVERY.md § "Risks: False positives storm" names the risk: without a "baseline establishment" mode, every running intent will fire `manual_change_assessment` on every file that has drifted for any reason since the agent last wrote it. Design must spec an explicit first-tick "just record SHAs, don't fire assessment" mode.

**Ambiguous-diff default behavior** — When the agent cannot confidently classify a diff (e.g., binary file replacement, large-scale restructuring that could be intentional or accidental), what is the fallback outcome? DISCOVERY.md § "Open questions: What does the agent do when it can't decide?" identifies this. Design should specify a default (most likely "surface as feedback with a 'cannot determine intent' note") so classification behavior is predictable.

**Human-write-path integrity stance** — As described in Decision 9, this is the most security-sensitive open question. Trust + audit vs. explicit human confirmation. Design must resolve it before the MCP tool can be specced.

**SPA upload availability per stage** — Is the upload affordance available in every stage, or only stages with a defined knowledge directory or outputs directory? Design must map the SPA's stage-specific availability to avoid surfacing "upload here" in stages where there's no clear target.

**Assessment record durability and location** — Once the agent classifies a drift event, where does the classification record live? It needs to be human-readable (visible in the SPA's drift assessment view) and durable (survives branch operations). The options roughly parallel the feedback mechanism (a new directory alongside feedback/) or a simpler append-log in state.json. Design owns this choice.

**Binary file degraded-mode behavior** — For figma exports, screenshots, and other binary stage outputs where the diff payload is uninformative, what signal does the agent receive and what is it expected to do? DISCOVERY.md § "Risks: Binary diffs are uninformative" flags this. Design should specify the v1 behavior (e.g., "file changed, binary, assume human intent is valid, apply 'acknowledge' classification unless otherwise instructed").

---

## Annex A: Upstream-Reconciliation Subsystem (Out-of-Scope, Co-Located)

The nine decisions above pertain exclusively to **out-of-band human file modifications**. A separate subsystem — **upstream-artifact reconciliation** — was authored on a different branch (`feat/prompt-files-and-validation`, repo PR #283, merged 2026-04-30) and entered this intent's branch via the 2026-05-01 main-merge. Its scope is detection of **cross-document divergence between agent-authored upstream artifacts** (tool-name divergence, HTTP-status-code divergence, field-name divergence) — orthogonal to human-write detection.

This annex exists so the inception decision record on this intent's branch acknowledges that subsystem's presence without conflating it with the nine decisions above.

**Decisions explicitly NOT made by this intent's inception:**

- The reconciliation subsystem's detection model (corpus walking, fingerprinting, divergence-class taxonomy) was not subject to a Decision-1-style alternatives analysis here. Its detection model is recorded only in its source module (`packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts`) and in the operations runbook scenarios that monitor it.
- The reconciliation subsystem's reaction mechanism (the `upstream_reconciliation_required` action and the `haiku_reconciliation_acknowledge` MCP tool) was not subject to a Decision-3-style alternatives analysis here. Its alternatives (e.g., piggyback on feedback-triage, harness-only enforcement, no escape-hatch) were not enumerated in this inception. Its reaction model is set by the implementation as it stands.
- The reconciliation subsystem's concurrency stance, sync surface scope, integrity stance, and open design decisions were not subject to Decisions-4-through-9-style records here.

**Future ownership path:** A future intent scoped specifically to upstream-artifact reconciliation should re-derive these decision rows on its own branch, treating the implementation as legacy and re-justifying the choices (or revising them).

**Cross-references:** See DISCOVERY.md § "Annexed Subsystem: Upstream-Reconciliation Pre-Tick Gate" for the full provenance, scope-orthogonality justification, and implementation pointers.
