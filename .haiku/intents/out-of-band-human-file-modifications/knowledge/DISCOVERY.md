# Discovery — Out-of-band human file modifications

## Business Context

### Feature goal & vision

Today, H·AI·K·U treats the agent as the sole legitimate writer of intent-associated files. Workflow-managed files (units, feedback, intent.md, state.json) are guarded by a PreToolUse hook that forces all writes through MCP tools, and stage outputs (figma exports, generated HTML, screenshots, knowledge artifacts, etc.) are produced by hats during execution. Anything a human edits "around" the system is invisible: the next `haiku_run_next` tick proceeds as if the file is what the agent last wrote, even when a designer has just dropped in a fresh layout, a PO has hand-edited a deliverable, or someone uploaded reference material into the elaborate phase.

The vision is a **sanctioned out-of-band write path** for humans, with **automatic detection on the next workflow tick** and a **classification step the agent runs against the diff**. Writes can arrive three ways — through a deliberate UI action (SPA upload, dedicated MCP tool), through a conversational instruction ("hey claude, write this file for me"), or through a silent filesystem drop. Detection has to cover all three; the system can't rely on the human announcing themselves. Once drift is observed, the agent — not the harness — decides what to do: ignore it, fold it into the next bolt, surface it as feedback, or trigger a stage revisit.

The desired outcome when this ships: humans regain control over their own work product without breaking out of the lifecycle. A designer who replaces a layout doesn't have to fight the agent to keep the change. A PO who tweaks a sentence and asks the agent to "extend this" gets exactly that — extension, not silent overwrite. A user with reference material doesn't have to reverse-engineer where to paste it; they drop the file and the system picks it up.

Why now: the agent-only write model is starting to leak. Three concrete examples surfaced in the same conversation, all from real workflow attempts. Each of them required a human to either give up the change or manually fight the framework. As more humans use H·AI·K·U on collaborative work (design handoffs, product reviews, knowledge curation), the friction compounds. The framework's promise of "human + AI knowledge unification" requires the humans to actually be able to write things.

### Origin & context

The request originated from a single conversation captured in `knowledge/CONVERSATION-CONTEXT.md`. The user invoked `/haiku:autopilot` from a parked worktree with no active intent matching the branch and described three motivating scenarios:

1. **Designer replaces a layout.** A designer hands off an updated figma export or HTML mock by replacing the file the agent previously wrote. Today the agent has no awareness this happened.
2. **PO makes a small edit and asks AI to extend.** A product owner edits a few sentences in a deliverable, then asks the agent to "build on this." The agent has no signal the file changed and may regenerate from its own last state, clobbering the human's edit.
3. **User uploads knowledge into elaborate.** A user drops a reference document — research notes, market data, design system tokens — into the inception/elaborate phase. The agent has no mechanism to discover the file unless the user explicitly cites it in chat.

A clarifying Q&A in that same conversation pinned down scope:

- Detection must be **both explicit and implicit** — silent filesystem drops have to be caught, so the system can't depend solely on UI announcements.
- SPA and review-app edits bypass workflow hooks because they're out-of-band human actions, not agent writes — hooks remain the boundary for agents only.
- All three motivating change types are in scope.
- A **new workflow action** (`manual_change_assessment`) handles the response — this is not piggybacked onto FB-triage.
- Target studio is software, with full paper + plugin + website sync.
- UX surface is a combination: SPA upload UI, manual filesystem drops, and the agent itself writing knowledge files out-of-band on user instruction.
- Concurrency model is **eventual consistency**: no locking. The next `haiku_run_next` tick observes drift and reacts.

There is no upstream customer ticket or external strategic mandate driving this — it surfaced from dogfooding the framework.

### Success criteria

**Functional (what users can do):**

- A designer can replace a stage output file (e.g., a layout, a figma export, a screenshot) directly in the worktree, and on the next workflow tick the agent acknowledges the change rather than silently regenerating over it.
- A PO can hand-edit a unit-output file or stage-output file and ask the agent to extend or refine it, and the agent treats the human's edit as the new baseline.
- A user can drop a knowledge file into the elaborate phase's knowledge directory (or upload it via the SPA) without touching chat, and the agent picks it up on the next tick and integrates it into elaboration.
- A user can ask the agent in chat to "write this file" for an out-of-band human-owned location (e.g., "save this Tailwind config to the design references"), and the resulting write is treated as an out-of-band human action even though the agent's hand made it.
- When drift is detected, the agent's classification decision (ignore / inline-fix / surface-as-FB / trigger revisit) is visible to the human — they can see what was found, what was decided, and why.

**Outcome-based (what business or user results we expect):**

- Humans stop circumventing the framework by working "outside" it for routine handoffs (design replacements, small edits, knowledge drops). The framework is now the path of least resistance for these flows, not the obstacle.
- Silent loss of human edits — currently a real failure mode — drops to zero for any file inside an intent's tracked surface.
- Designers and product owners can collaborate inside an active intent without needing to understand MCP tools or hooks.
- The "human + AI knowledge unification" promise lands for at least these three workflows, which are the most common collaboration patterns surfaced so far.

## Competitive Landscape

The closest analogues to H·AI·K·U's situation come from other agent-orchestration frameworks and from collaborative editing tools that sit between humans and machines. None solve exactly this problem, but each highlights a partial pattern.

### Specific products and approaches

**Cursor** (https://cursor.sh) — Cursor's agent edits files alongside the human in real time. Cursor has no "workflow phase" notion, so there's no concept of a stage output the human is forbidden to touch. Drift detection is implicit through normal git status and file watches; the agent re-reads on each turn. Cursor does not have a structured human-vs-agent change ledger — both humans and agents are first-class writers, and reconciliation is left to the user's judgment plus git.
- *What they do well:* First-class human writer model removes friction entirely. The human never has to ask permission, and the agent treats human edits as authoritative without ceremony.
- *Gap:* Cursor has no structured workflow concept — there are no stages, gates, or phase-specific output surfaces to protect or assess. Drift detection is implicit (re-read on next turn) and there is no classification of what the change means for the current plan.

**Aider** (https://aider.chat) — Aider explicitly tracks files it has been given access to, and when the human edits a tracked file outside the chat, Aider notices on the next turn and re-reads the file before responding. The pattern is "the human's edits are authoritative; the agent re-reads before acting." There is no formal classification step — Aider just incorporates the new state and proceeds.
- *What they do well:* "Human edit is authoritative" stance is clean and predictable. No locking, no classification ceremony — just re-read and proceed. For low-ceremony scenarios this is the right default.
- *Gap:* No structured workflow, no stage-scoped tracked surface, and no notion that a human edit might require re-planning rather than just re-reading. Silent filesystem drops outside the chat session go unnoticed unless the human explicitly adds the file.

**GitHub Copilot Workspace** (https://githubnext.com/projects/copilot-workspace) — Workspace structures work into a plan-then-execute flow somewhat similar to H·AI·K·U's stages. The human can edit any artifact in the workspace (the spec, the plan, the implementation), and the agent picks up edits on the next iteration. Drift is handled by simple re-read; there is no formal classification.
- *What they do well:* Iteration model shows that in a structured workflow, the agent simply re-reading on the next turn is often enough. You don't always need a separate classification step — the agent can just adapt.
- *Gap:* Human writes are treated as "just another edit" rather than a workflow signal that may require re-planning or a stage revisit. There is no classification of intent (small extension vs. redirect vs. regression). The human edit and the agent's prior plan can conflict silently.

**Devin** (https://devin.ai) — Devin runs largely autonomously with the human commenting on a PR-like surface. Human edits to the workspace are uncommon in normal use — the interaction model is "Devin works, human reviews." When the human does intervene, Devin restarts or re-evaluates. There is no fine-grained classification of human vs. agent changes.
- *What they do well:* The PR-comment model creates a clear audit trail of human direction. Devin's restart-on-human-intervention is predictable: the human knows intervention has a cost, which keeps it deliberate.
- *Gap:* Human intervention is coarse-grained (restart or abandon) — there is no "fold this small edit into the current bolt" path. Silent filesystem drops are not part of the model at all. Devin is fundamentally designed for a "Devin drives, human reviews" dynamic, not collaborative editing.

**Figma + Code Connect** (https://www.figma.com/code-connect-docs/) — Figma's design-handoff story routes design changes through a structured surface (the Figma file) that engineers consume separately. The "designer replaces a layout" scenario in our intent is exactly the gap Code Connect tries to close — but Code Connect assumes the designer keeps editing in Figma and the engineer pulls. It does not handle "designer drops a new file directly into the engineer's workspace."
- *What they do well:* Separation of design surface from engineering surface is a proven pattern for design handoff. Changes are always authored in Figma and consumed via a structured pull — no ambiguity about who wrote what.
- *Gap:* The model breaks the moment the designer leaves Figma. A PNG dropped into the repo, a new HTML mock placed in the output directory, or any out-of-Figma handoff is invisible to Code Connect. The "designer drops a file in the workspace" scenario is exactly the gap, and there is no detection or classification for it.

**Notion AI / Coda AI** (https://www.notion.so/product/ai , https://coda.io/product/ai) — Block-level collaborative documents where humans and AI co-edit. The reconciliation pattern is operational-transform-style real-time merging: every change has an author, every change is tracked, and conflicts are resolved at the block level. This is a much higher-touch collaboration model than H·AI·K·U needs, but it demonstrates the value of attributing changes to author.
- *What they do well:* Per-block authorship attribution demonstrates that knowing who wrote a change unlocks downstream behavior — accountability, undo, review, conflict resolution. Every write is an event, and events are first-class.
- *Gap:* Operational-transform collaboration is a web-native, real-time model — it requires the human to be inside the tool's editing surface. It does not generalize to filesystem drops, SPA uploads, or agent-writes-on-behalf-of-human. The model assumes both writers are actively online and editing the same document simultaneously.

**Cody / Continue / other IDE agents** (https://sourcegraph.com/cody , https://continue.dev) — These agents read the working tree fresh on each turn and don't track who wrote what. The human is implicitly in charge; the agent is a tool the human invokes.
- *What they do well:* Zero-ceremony human edit model — the human edits files freely and the agent picks them up on the next invocation. No tracking, no state, no drift detection overhead.
- *Gap:* There is no concept of a workflow lifecycle, stage-scoped tracked surfaces, or a history of what the agent last produced. Every invocation is stateless. Human edits that have structural implications (requiring a plan change, a stage revisit, a new knowledge integration) are invisible to the agent beyond the raw file state.

### Differentiator summary

None of these tools combine a structured multi-stage workflow with first-class out-of-band human writes. Aider and Cursor have no workflow. Workspace has a workflow but treats human writes as incidental edits rather than workflow signals. Devin's restart model is too coarse. Notion demonstrates authorship attribution but doesn't operate outside its own document surface. H·AI·K·U's opportunity is to turn out-of-band writes into a *first-class workflow signal* — not a thing to ignore, not a thing to forbid, but an event the agent classifies and responds to with stage-appropriate action.

The `manual_change_assessment` action is genuinely novel: the agent looks at the diff and asks "is this a small extension I can fold into the current bolt? a regression that should become feedback? a fundamental redirect that requires going back?" No comparable tool has this step. Silent filesystem drops are universally underserved — every analogue requires the human to do something in-app for the agent to notice. H·AI·K·U's plan to baseline and diff on every tick catches the dropped-file case no competitor handles cleanly.

## Considerations & Risks

### Strategic considerations

- **Compliance scope** — The framework already tracks who wrote workflow-managed files (agent-only, MCP-mediated). Out-of-band writes introduce a second author class (human, untracked at the hook level). For audit-conscious users (regulated industries, security reviews), the system needs to be able to answer "who changed this file and when" for any tracked surface. Today the answer for human writes would be "git blame" — that's probably fine, but the question should be on the table during design.
- **Pricing implications** — None obvious. The detection and classification work is local computation; no external API spend.
- **Rollout strategy** — Detection and the new workflow action ship together. The SPA upload UI is a separate user-facing surface and could ship in a later phase if needed; the implicit-detection path covers the base case. The "Claude writes knowledge out-of-band on user instruction" path needs an explicit MCP tool or skill so the agent has a sanctioned way to do it.
- **Behavior change for existing intents** — Once shipped, every running intent starts getting drift detection. If existing intents have files that have drifted from their agent-written state for unrelated reasons (manual cleanup, git rebases, etc.), they'll get a flood of `manual_change_assessment` actions on the next tick. Need a baseline-establishment moment — first tick after upgrade just records SHAs without firing the action.
- **Interaction with locked worktrees and parked branches** — The user's global rules include strict "do not touch locked worktrees" semantics. Drift detection across worktrees and parked branches needs to respect those boundaries.

### Capability needs

- **Per-stage SHA baseline storage.** The system needs a place to record "this is the SHA the agent last produced for each tracked file in this stage" so drift can be detected on the next tick. This is state — needs to live somewhere the workflow already reads on every tick.
- **Per-tick diff detection.** A pre-tick gate (analogous to the existing feedback-triage gate) walks the tracked surface, hashes each file, compares against the baseline, and emits drift events.
- **Diff-classification capability.** The agent receives a structured payload describing the changed files plus the unified diff and decides what to do. This is a new workflow action; the classification logic is in the agent's hands, not the harness's.
- **Sanctioned upload UI.** A user-facing surface (likely in the existing browse/review SPA) that lets a human attach a file to a stage's knowledge or output area without using the filesystem.
- **Sanctioned "agent writes on behalf of human" tool.** A dedicated MCP tool that lets the agent write a file as a human-class write, distinct from a normal agent-class write. This is the path for "hey claude write this file for me."
- **Diff presentation.** The classification step needs to see the full diff, not just file-level "changed/unchanged." For binary files (figma exports, screenshots), needs a degraded-mode signal.
- **Rejection / acknowledgment record.** Once the agent classifies a change, the decision and rationale need to live somewhere durable so a human reviewing the intent later can see what was found and what was decided.

### Open questions

- **Which files are part of the "tracked surface"?** Stage outputs and knowledge files clearly are. What about files inside `units/{unit-slug}/` directories that the agent creates during execution? Files outside `.haiku/` that the agent touches as part of its work (source code, configs)? The intent description suggests stage outputs (figma/html/image), elaborate-phase knowledge uploads, and small edits — but the boundary needs to be drawn.
- **What does the agent do when it can't decide?** If the diff is ambiguous — could be an intentional human edit, could be a clobber from another process — does it default to "surface as FB and let a human decide" or does it have a more aggressive default?
- **How does the SPA upload UI integrate with stages that don't have a clear "upload here" target?** Inception/elaborate has a knowledge directory; design might have an outputs directory; development has units. Is upload available in every stage or only some?
- **What happens when the human edits a workflow-managed file (units, feedback, intent.md, state.json) directly via the filesystem instead of MCP?** Currently the hook prevents agents from doing this but doesn't prevent humans. Is that an in-scope detection case, or out-of-scope because workflow-managed files are agent-only by contract and humans should never touch them?
- **What's the user experience when drift is detected during an autonomous (autopilot) run?** Does the agent pause and surface the classification decision for confirmation, or does it decide silently and log? The conversation context says the agent "decides" — suggesting silent classification — but autopilot/discrete/hybrid modes may want different defaults.
- **How does this interact with revisit?** If drift is detected on a file owned by an earlier stage, does the assessment automatically trigger revisit, or is that one of the four classification outcomes the agent picks?
- **Does the SPA upload UI itself become a workflow event, or just a filesystem write that the existing detection picks up on the next tick?** If the SPA writes to disk and lets the next tick discover the change, the implementation surface is much smaller. If it talks directly to the workflow engine, it's a richer integration.
- **How is the human-class write distinguished from an agent-class write at the storage layer?** Is it a separate baseline file? A flag in the existing baseline? Git-author-based heuristic?
- **What about partial writes / editor temp files?** A human editor saving via tempfile-then-rename can briefly create files that look like drift but aren't. Detection needs to be stable against this.

### Risks

- **False positives storm.** If the baseline-establishment moment isn't carefully designed, the first tick after upgrade fires `manual_change_assessment` for every file in every running intent. We need an explicit "establish baseline now, don't fire" mode for the first observation of any file.
- **Classification gets stuck in a loop.** If the agent classifies a change as "ignore," the diff is still on disk. Next tick, drift is still detected. We need either a "drift acknowledged" record that updates the baseline, or a classification outcome that explicitly snapshots the new state as the new agent-acknowledged baseline.
- **Eventual consistency window may surprise users.** A designer who uploads a layout expects the agent to act on it "now." If the next tick is hours away (or the intent is paused), the change sits in limbo. Need to communicate clearly that detection is on-tick, not real-time, and provide a way for the human to nudge a tick.
- **Concurrency vs. agent in-flight writes.** If the human edits a file while the agent is mid-bolt, both writes can land in the same git state. The "next tick observes drift" model works, but the agent's mid-bolt work may be partially based on the pre-edit version. The conversation context accepts this as eventual consistency, but it's worth flagging as an explicit risk.
- **Trust erosion if the agent classifies wrong.** A "small edit you should extend" misclassified as "trigger revisit" wastes a stage. A "fundamental redirect" misclassified as "ignore" silently drops the human's intent. The classification quality matters; this is an agent-judgment problem that compounds across the workflow.
- **Implicit detection misses non-tracked files.** If the human drops a file in a directory we don't watch, it's invisible. The first version will likely have a fixed list of tracked directories per stage — if the human drops outside, no detection. Out-of-scope for v1 but worth flagging.
- **Binary diffs are uninformative.** For figma exports, images, and other binary stage outputs, the diff payload won't help the agent classify. The agent has to fall back to "the file changed; assume the human knows what they're doing" or invoke a vision tool. Either path is acceptable but the v1 behavior should be explicit.
- **Hook bypass becomes a liability.** SPA / review-app / direct filesystem writes bypassing PreToolUse is correct for humans, but if an agent ever finds a way to pose as a human (writing through the SPA path, calling the human-write MCP tool intentionally), the workflow-managed-file guarantees evaporate. This is a security boundary worth protecting.
- **Cross-cutting boundary with existing pre-tick gates** — *boundary to the workflow-engine artifact*: this intent introduces a new pre-tick gate alongside the existing feedback-triage gate. The two need a clear ordering and interaction story, but the substance belongs in the workflow-engine sibling artifact, not here.
- **Cross-cutting boundary with workflow-managed-file hook policy** — *boundary to the security/hooks artifact*: the existing hook is the line between "agents must use MCP" and "humans can do whatever." This intent leaves that boundary intact and adds parallel detection for human writes; if the security artifact recommends tightening the hook (e.g., warning humans before edits), this needs to be coordinated.

## UI Impact

### Affected surfaces

- **Browse / review SPA — stage output area.** A new upload affordance for replacing or attaching files to a stage's outputs (designer drops a layout, PO swaps a screenshot). Must be available per stage and respect the stage's notion of "outputs."
- **Browse / review SPA — knowledge upload area.** A new affordance in the elaborate-phase view for uploading reference material (research, design tokens, market data). Distinct from output replacement; this is additive material, not a swap.
- **Browse / review SPA — drift assessment view.** When `manual_change_assessment` fires, the human looking at the intent in the SPA needs to see what changed, what the agent decided, and why. A new view (or a new section in the existing intent overview) showing recent drift events and their classifications.
- **Chat / agent conversation surface.** When the user says "hey claude write this file," the agent invokes the human-write MCP tool and the resulting write is annotated as out-of-band. The conversation surface should probably acknowledge the write happened ("saved as a human-attributed file in stage X") so the user understands the change was tracked, not regenerated.
- **Drift notifications in chat.** When a tick observes drift, the agent's response in chat should clearly surface what was found and what was decided, so the human knows the change was registered. This is not a new screen — it's a content change in the existing chat surface.
- **Documentation pages.** New docs explaining the out-of-band write paths, the detection model, the eventual-consistency guarantee, and the four classification outcomes. Located in the website's user-facing docs, not the implementation reference.

No new top-level navigation. All UI changes attach to existing surfaces (browse SPA, chat, docs).

## Overlap Awareness

A scan of active H·AI·K·U branches at discovery time (2026-04-28) identified five active branches beyond this intent's own (`origin/haiku/out-of-band-human-file-modifications/main`). The results are below.

**`origin/haiku/remote-review-spa/main`** — This branch has substantial in-flight work on `packages/haiku/review-app/` — the browse/review SPA. Components like `ReviewPage.tsx`, `App.tsx`, and the iframe decision-panel suite are actively in motion. This is a direct surface overlap: this intent needs to add upload affordances (stage output upload, knowledge upload, drift assessment view) to the same browse SPA. Re-check at design and execution time to avoid conflict on the same component files.

**`origin/haiku/archivable-intents/main`** and **`origin/haiku/cascading-model-selection/main`** — Both branches carry broad changes to `packages/haiku/src/` including `orchestrator.ts`, `state-tools.ts`, and the entire `hooks/` directory. This intent will need to add a pre-tick gate and a new workflow action to those same files. The surface area is not file-for-file identical (different feature domains), but merging multiple branches that each add hooks entries, orchestrator cases, and state-tool mutations will require coordination. Worth tagging as a likely merge coordination point at execution time.

**`origin/haiku/cowork-mcp-apps-integration/main`** — Touches `packages/haiku/review-app/` (browse SPA components, host-bridge, session hooks) and some `packages/haiku/src/` files. Moderate overlap with the SPA upload UI work this intent plans, particularly if the cowork branch is restructuring the host-bridge or session model that a new upload endpoint would need to integrate with.

**`origin/haiku/unit-metrics-and-browse-dashboards/main`** — No shared file-level overlap with the workflow engine or SPA upload paths detected. Changes appear to be scoped to intent-directory files. Not a concern.

None of these are blockers for inception. They are coordination signals for design (where the upload UI fits into the SPA's component architecture given ongoing cowork and remote-review-spa work) and execution (where adding hooks and orchestrator cases may produce merge complexity with archivable-intents and cascading-model-selection). The design stage should produce a read on the remote-review-spa branch's component structure before speccing the upload UI.

## Annexed Subsystem: Upstream-Reconciliation Pre-Tick Gate

**Provenance:** This subsystem was authored on a separate branch (`feat/prompt-files-and-validation`, repo PR #283 "feat(orchestrator): file-based dispatch + reconciliation + unit-write validation", merged 2026-04-30) and entered this intent's branch transitively via the 2026-05-01 main-merge into `haiku/out-of-band-human-file-modifications/main`. It was NOT proposed in this intent's discovery or scoped through this intent's elaboration. It is documented here for traceability so the cross-stage chain (inception → product → design → development → operations) is unbroken on the intent branch despite the out-of-band origin.

**Scope orthogonality:** The reconciliation subsystem detects **cross-document divergence between agent-authored upstream artifacts** (tool-name divergence, HTTP-status-code divergence, field-name divergence). Its scope is independent of this intent's `human file modifications` framing — it does not detect human writes, does not consume the SHA baseline this intent introduces, and does not feed the `manual_change_assessment` action. It runs as an **additional pre-tick gate** alongside the drift-detection gate this intent specifies. The inception-stage analysis treats it as an externally-introduced concern co-located on this branch, not as an in-scope discovery deliverable.

**Where it lives in the implementation:**

- Module: `packages/haiku/src/orchestrator/workflow/upstream-reconciliation.ts`
- Pre-tick wiring: `packages/haiku/src/orchestrator/workflow/run-tick.ts` (emits action `upstream_reconciliation_required`)
- MCP tool: `haiku_reconciliation_acknowledge` (proceed-without-fix escape hatch when divergence is intentional)
- Telemetry: `haiku.reconciliation.fingerprint.{matched,drifted,established,duration_ms,write_failed}`, `haiku.reconciliation.corpus.bytes` (`packages/haiku/src/telemetry.ts`)
- Alerts: `deploy/operations/drift-detection-alerts.yaml` (reconciliation-* rules)
- Tests: `packages/haiku/test/upstream-reconciliation.test.mjs`
- Operations runbook: `stages/operations/units/unit-01-operational-runbook.md` scenarios 5 ("Reconciliation fingerprint mismatch") and 11 ("Reconciliation gate fires on stage with stale fingerprint")
- Operations telemetry coverage: `stages/operations/units/unit-02-telemetry-coverage.md`

**Disposition for downstream stages:**

- Product, design, and development specs in this intent treat reconciliation as **annexed**, not as a v1 deliverable. They reference this section for provenance and do not author fresh acceptance criteria, data contracts, behavioral specs, or unit specs against it.
- Operations specs reference reconciliation because the subsystem was already on the branch when operations ran; they treat it as an **inherited operational surface** to monitor, not a feature this intent designed.
- Future product cycles that want to take ownership of reconciliation should open a separate intent ("upstream-artifact reconciliation") that traces it through inception → product → design → development on its own merits.

**Why this is documented as annex rather than retroactively scoped in:** Retroactively framing reconciliation as "always part of this intent's vision" would falsify the discovery record. The original conversation (`knowledge/CONVERSATION-CONTEXT.md`) and the success criteria above are unambiguously about human-authored writes, not about agent-authored cross-document drift. Annexing preserves the honest cross-stage trace this verifier-style finding asked for without inventing a vision the inception stage did not have.
