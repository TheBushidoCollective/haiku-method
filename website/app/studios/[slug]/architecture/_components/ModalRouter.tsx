"use client"

import { ACTORS } from "../_data/actors"
import { HOOK_BY_NAME } from "../_data/hooks"
import type {
	DerivedStage,
	ModalKind,
	StudioContentEntry,
} from "../_data/types"
import { HtmlBlock, Modal } from "./Modal"
import { renderInline, renderMarkdown, renderMdFile } from "./utils"

interface ModalRouterProps {
	modal: ModalKind | null
	onClose: () => void
	studioContent: StudioContentEntry | null
	stages: DerivedStage[]
}

/** Single source of truth for the modal-shape switch. Each `ModalKind`
 *  case renders a `<Modal>` with the appropriate body. Returns null when
 *  `modal` is null or the case can't resolve required content (e.g. a
 *  stage key that no longer exists in the loaded studio). */
export function ModalRouter({ modal, onClose, studioContent, stages }: ModalRouterProps) {
	if (!modal) return null

	switch (modal.kind) {
		case "actor": {
			const a = ACTORS[modal.actorKey]
			if (!a) return null
			return (
				<Modal open title={`${a.icon} ${a.name}`} subtitle="actor · runtime player" onClose={onClose}>
					<div className="modal-section">
						<h3>role</h3>
						<HtmlBlock className="prose" html={renderInline(a.role)} />
					</div>
					<div className="modal-section">
						<h3>talks to</h3>
						<ul>
							{a.talks_to.map((t) => (
								<li key={t}>
									<HtmlBlock html={renderInline(t)} />
								</li>
							))}
						</ul>
					</div>
					<div className="modal-section">
						<h3>owns</h3>
						<ul>
							{a.owns.map((o) => (
								<li key={o}>
									<HtmlBlock html={renderInline(o)} />
								</li>
							))}
						</ul>
					</div>
					<div className="modal-section">
						<h3>notes</h3>
						<HtmlBlock className="md-content" html={renderMarkdown(a.notes)} />
					</div>
				</Modal>
			)
		}
		case "hook": {
			const h = HOOK_BY_NAME[modal.hookName]
			if (!h) return null
			return (
				<Modal open title={modal.hookName} subtitle={`hook · ${h.group}`} onClose={onClose}>
					<div className="modal-section">
						<h3>role</h3>
						<HtmlBlock className="prose" html={renderInline(h.desc)} />
					</div>
					<div className="modal-section">
						<h3>where it fires</h3>
						<ul>
							{h.fires.map((f) => (
								<li key={f}>
									<code>{f}</code>
								</li>
							))}
						</ul>
					</div>
					<div className="modal-section">
						<h3>file</h3>
						<div className="payload-block">{h.file}</div>
					</div>
				</Modal>
			)
		}
		case "payload": {
			const d = modal.payload
			return (
				<Modal open title="haiku_run_next" subtitle={`${d.stage} · ${d.key}`} onClose={onClose}>
					<div className="modal-section">
						<h3>action</h3>
						<div className="payload-block" style={{ fontWeight: 600, color: "#2563eb" }}>
							{d.action}
						</div>
					</div>
					<div className="modal-section">
						<h3>summary</h3>
						<HtmlBlock className="prose" html={renderInline(d.summary)} />
					</div>
					<div className="modal-section">
						<h3>payload returned to agent</h3>
						<div className="payload-block">{JSON.stringify(d.payload, null, 2)}</div>
					</div>
					<div className="modal-section">
						<h3>orchestrator validations</h3>
						<ul>
							{d.validations.map((v) => (
								<li key={v}>
									<HtmlBlock html={renderInline(v)} />
								</li>
							))}
						</ul>
					</div>
					{d.writes && d.writes.length ? (
						<div className="modal-section">
							<h3>state writes (workflow engine persists to disk)</h3>
							<ul className="writes-list">
								{d.writes.map((w) => (
									<li key={w.path + w.change}>
										<code className="write-path">{w.path}</code>
										<HtmlBlock className="write-change" html={renderInline(w.change)} />
									</li>
								))}
							</ul>
						</div>
					) : null}
					{d.injection && d.injection.length ? (
						<div className="modal-section">
							<h3>how the result reaches the agent</h3>
							<ul className="writes-list">
								{d.injection.map((i) => (
									<li key={i.hook + i.target} style={{ borderLeftColor: "#2563eb" }}>
										<code className="write-path" style={{ color: "#1e3a8a" }}>{i.hook}</code>
										<HtmlBlock
											className="write-change"
											html={`→ <strong>${renderInline(i.target)}</strong>`}
										/>
										<HtmlBlock className="write-change" style={{ marginTop: 2 }} html={renderInline(i.what)} />
									</li>
								))}
							</ul>
						</div>
					) : null}
					<div className="modal-section">
						<h3>instructions</h3>
						<HtmlBlock className="prose" html={renderInline(d.instructions)} />
					</div>
				</Modal>
			)
		}
		case "stageMd": {
			const s = studioContent?.stages?.[modal.stageKey]
			if (!s) return null
			return (
				<Modal
					open
					title={`${modal.stageKey.toUpperCase()} · STAGE.md`}
					subtitle={s.stagePath}
					onClose={onClose}
				>
					<HtmlBlock
						className="md-content"
						html={renderMdFile({ frontmatter: s.frontmatter, content: s.stageMd })}
					/>
				</Modal>
			)
		}
		case "hat": {
			const file = studioContent?.stages?.[modal.stageKey]?.hats?.[modal.hatName]
			if (!file) return null
			return (
				<Modal open title={`${modal.hatName} · hat`} subtitle={file.path} onClose={onClose}>
					<HtmlBlock className="md-content" html={renderMdFile(file)} />
				</Modal>
			)
		}
		case "reviewAgent": {
			const file = studioContent?.stages?.[modal.stageKey]?.reviewAgents?.[modal.agentName]
			if (!file) return null
			return (
				<Modal
					open
					title={`${modal.agentName} · review agent`}
					subtitle={file.path}
					onClose={onClose}
				>
					<HtmlBlock className="md-content" html={renderMdFile(file)} />
				</Modal>
			)
		}
		case "subagent":
			return (
				<Modal
					open
					title={`↗ ${modal.hatName} runs in a subagent`}
					subtitle={`${modal.stageKey} · subagent-context`}
					onClose={onClose}
				>
					<div className="modal-section">
						<h3>what this means</h3>
						<HtmlBlock
							className="prose"
							html={renderInline(
								`Every hat — including \`${modal.hatName}\` — runs inside its own Claude Code subagent. The orchestrator's pattern at execute time is "one subagent per unit per hat."`,
							)}
						/>
					</div>
					<div className="modal-section">
						<h3>tools the subagent uses</h3>
						<ul>
							<li><code>haiku_unit_start</code></li>
							<li><code>haiku_unit_advance_hat</code></li>
							<li><code>haiku_unit_reject_hat</code></li>
							<li><code>haiku_unit_increment_bolt</code></li>
						</ul>
					</div>
				</Modal>
			)
		case "schema":
			return (
				<Modal open title={modal.schemaKey} subtitle="schema reference" onClose={onClose}>
					<HtmlBlock
						className="prose"
						html={renderInline(
							`See \`packages/haiku/src/state-tools.ts\` for the canonical type definitions of \`${modal.schemaKey}\`.`,
						)}
					/>
				</Modal>
			)
		case "validation":
			return (
				<Modal
					open
					title={`✓ ${modal.validationKey}`}
					subtitle="elaborate-phase validation gate"
					onClose={onClose}
				>
					<HtmlBlock
						className="prose"
						html={renderInline(
							`Validation check enforced by \`packages/haiku/src/orchestrator/workflow/handlers/elaborate.ts\` and \`validators.ts\`. See repo for the full rule set.`,
						)}
					/>
				</Modal>
			)
		case "revisit": {
			const prev = modal.stageIdx > 0 ? stages[modal.stageIdx - 1]?.name ?? null : null
			const stageName = stages[modal.stageIdx]?.name ?? modal.stageKey
			return (
				<Modal open title="↺ /haiku:revisit" subtitle={`${stageName} · go-back semantics`} onClose={onClose}>
					<div className="modal-section">
						<h3>summary</h3>
						<HtmlBlock
							className="prose"
							html={renderInline(
								"Bounces the workflow engine backwards to re-elaborate work that's already been done. Clears the target stage's `gate_outcome` and re-enters its `elaborate` phase.",
							)}
						/>
					</div>
					{prev ? (
						<div className="modal-section">
							<h3>cross-stage variant</h3>
							<HtmlBlock
								className="prose"
								html={renderInline(`From **${stageName}**'s elaborate → bounces back to **${prev}**'s elaborate.`)}
							/>
						</div>
					) : null}
				</Modal>
			)
		}
		case "gateDetail":
			return (
				<Modal
					open
					title={modal.detailKey}
					subtitle="nested gate inside haiku_run_next"
					onClose={onClose}
				>
					<HtmlBlock
						className="prose"
						html={renderInline(
							modal.detailKey === "specs_gate_review"
								? "The post-elaboration review gate. Runs **inside the same** `haiku_run_next` call. After 2026-04-27, reject does not re-pop the UI: open feedback routes through `feedback_dispatch` (human, no resolution) or `review_fix` (inline-fix) until every FB closes."
								: "Hard quality gates — tests, lint, typecheck — run inside the same `haiku_run_next` call that transitions execute → review. Loop iterates within review; never goes back to execute.",
						)}
					/>
				</Modal>
			)
		case "tool":
			return (
				<Modal
					open
					title={modal.toolName}
					subtitle={`mcp tool · ${modal.contextKey ?? ""}`}
					onClose={onClose}
				>
					<HtmlBlock
						className="prose"
						html={renderInline(
							`See \`packages/haiku/src/orchestrator.ts\` and \`state-tools.ts\` for the full schema of \`${modal.toolName}\`.`,
						)}
					/>
				</Modal>
			)
		case "skill":
			return (
				<Modal open title={modal.skillName} subtitle="skill" onClose={onClose}>
					<HtmlBlock
						className="prose"
						html={renderInline(
							`See \`plugin/skills/${modal.skillName.replace(/^\/haiku:/, "")}/SKILL.md\` for the full skill mandate.`,
						)}
					/>
				</Modal>
			)
		case "aux": {
			const file = studioContent?.[modal.auxKind]?.[modal.name]
			if (!file) return null
			return (
				<Modal
					open
					title={`${modal.auxKind.replace(/s$/, "")} · ${modal.name}`}
					subtitle={file.path}
					onClose={onClose}
				>
					<HtmlBlock className="md-content" html={renderMdFile(file)} />
				</Modal>
			)
		}
		case "unit":
			return (
				<Modal
					open
					title={modal.unitId}
					subtitle={`${modal.stageName} · unit detail`}
					onClose={onClose}
				>
					<HtmlBlock
						className="prose"
						html={renderInline(
							`Demo unit \`${modal.unitId}\` (model: \`${modal.model}\`). In a real intent, units live at \`.haiku/intents/{slug}/stages/${modal.stageName.toLowerCase()}/units/\`.`,
						)}
					/>
				</Modal>
			)
		case "artifact": {
			const [stageKey, slug] = modal.artifactKey.split(".")
			const def =
				stageKey && slug
					? (studioContent?.stages?.[stageKey]?.discoveryDefs?.[slug] ??
						studioContent?.stages?.[stageKey]?.outputDefs?.[slug] ??
						null)
					: null
			if (!def) {
				return (
					<Modal open title={modal.artifactKey} subtitle="no template defined" onClose={onClose}>
						<HtmlBlock
							className="prose"
							html={renderInline(
								`No \`discovery/\` or \`outputs/\` template was found in the studio for \`${modal.artifactKey}\`. The artifact still flows through the pool — it's just not formally specified by the studio.`,
							)}
						/>
					</Modal>
				)
			}
			return (
				<Modal open title={modal.artifactKey} subtitle={def.path} onClose={onClose}>
					<HtmlBlock className="md-content" html={renderMdFile(def)} />
				</Modal>
			)
		}
		case "intentCreation":
			return (
				<Modal open title="Intent creation" subtitle="user ↔ agent · /haiku:start" onClose={onClose}>
					<HtmlBlock
						className="prose"
						html={renderInline(
							"User and agent exchange Q&A until the agent has enough to draft `intent.md`. The agent calls `haiku_select_studio` (default inferred from prompt), then `haiku_intent_create`, then `haiku_run_next` to enter the first stage's elaborate phase.",
						)}
					/>
				</Modal>
			)
		case "preTickTriage":
			return (
				<Modal
					open
					title="⛓ pre-tick triage gate"
					subtitle="run-tick.ts · interceptor · runs BEFORE every per-state handler"
					onClose={onClose}
				>
					<div className="modal-section">
						<h3>where it sits</h3>
						<HtmlBlock
							className="prose"
							html={renderInline(
								"Implemented in `packages/haiku/src/orchestrator/workflow/run-tick.ts` (`preTickFeedbackGate`). On every `haiku_run_next` tick — after structural repair (`preTickConsistency`) and tamper detection (`verifyIntentState`) but BEFORE the per-state handler — the gate walks stages 0..current plus intent-scope for open (non-terminal) feedback. The point: misplaced or untriaged feedback can't be force-fixed by the wrong stage's hats, and a stage handler can't re-pop the review UI while feedback is still unaddressed.",
							)}
						/>
					</div>
					<div className="modal-section">
						<h3>three priority outcomes</h3>
						<ul className="writes-list">
							<li>
								<HtmlBlock
									className="prose"
									html={renderInline(
										"**1. Untriaged FB found** — any open FB lacking `triaged_at:` → emit `feedback_triage`. Agent calls `haiku_feedback_move` (same-stage no-op confirms in place; cross-stage relocates the file to the correct stage's `feedback/` dir).",
									)}
								/>
							</li>
							<li>
								<HtmlBlock
									className="prose"
									html={renderInline(
										"**2. Triaged but on an earlier stage** — every open FB has `triaged_at:` but ≥ 1 sits on a stage earlier than `active_stage` → emit `revisited` targeting the earliest such stage. The existing revisit machinery handles branch state, downstream invalidation, and re-entry.",
									)}
								/>
							</li>
							<li>
								<HtmlBlock
									className="prose"
									html={renderInline(
										"**3. Triaged and in-scope (or no open FB)** — fall through to the per-state handler. The stage gate then routes pending feedback through `feedback_dispatch` (human comments without resolution) or the worktree-based `review_fix` chain (inline-fix items).",
									)}
								/>
							</li>
						</ul>
					</div>
					<div className="modal-section">
						<h3>why it exists</h3>
						<HtmlBlock
							className="prose"
							html={renderInline(
								"Before this gate, the per-stage handler could see open feedback on a downstream stage and dispatch it to its own `fix_hats` — wrong stage, wrong hats, wrong fix. It could also re-emit `gate_review` even when the user had left feedback that was never addressed (the loop fixed on 2026-04-27). Centralizing the triage check ensures every tick passes through the same chokepoint.",
							)}
						/>
					</div>
					<div className="modal-section">
						<h3>frontmatter convention</h3>
						<HtmlBlock
							className="prose"
							html={renderInline(
								"Agent-authored FBs (`origin: agent`, `adversarial-review`, `studio-review`, etc.) auto-stamp `triaged_at:` at creation time — they're filed in-context. Human origins (`user-chat`, `user-visual`, `user-question`) leave `triaged_at: null`, which is what triggers outcome 1 above.",
							)}
						/>
					</div>
				</Modal>
			)
	}
}
