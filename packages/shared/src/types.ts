// Shared H·AI·K·U types used by both the website and review-app

import type { ProgressStep } from "./progress-milestones"

export interface HaikuIntent {
	slug: string
	title: string
	studio: string
	studioStages: string[]
	activeStage: string
	mode: string
	stagesComplete: number
	stagesTotal: number
	status: string
	/** Whether the intent has been archived (hidden from default listings) */
	archived?: boolean
	createdAt: string | null
	startedAt: string | null
	completedAt: string | null
	composite: Array<{ studio: string; stages: string[] }> | null
	follows: string | null
	content?: string
	raw: Record<string, unknown>
	/** The git branch this intent lives on (populated when scanning haiku/* branches) */
	branch?: string
	/** PR/MR URL if one exists for this intent's branch */
	prUrl?: string | null
	/** PR/MR state: "open", "merged", "closed" */
	prStatus?: string | null
	/** PR/MR number */
	prNumber?: number | null
}

export interface HaikuUnit {
	name: string
	stage: string
	status: string
	dependsOn: string[]
	bolt: number
	hat: string
	startedAt: string | null
	completedAt: string | null
	refs: string[]
	/** Intent-relative paths the unit consumes (upstream outputs, knowledge
	 *  artifacts, the spec it implements). From the unit FM `inputs:` field. */
	inputs: string[]
	outputs: string[]
	criteria: Array<{ text: string; checked: boolean }>
	content: string
	raw: Record<string, unknown>
}

export interface HaikuArtifact {
	name: string
	content?: string
	rawUrl?: string
	type: "markdown" | "html" | "image" | "other"
}

export interface HaikuKnowledgeFile {
	name: string
	content: string
}

export interface HaikuStageState {
	name: string
	status: "pending" | "active" | "complete"
	phase: string
	/** Granular per-stage milestone track (elaborate → each review role →
	 *  execute → each approval role), derived from per-unit FM. Mirrors the
	 *  status-line / SPA track so the browse PhaseStepper can render a
	 *  fine-grained strip. Absent/empty on stages derived from a legacy
	 *  state.json or with no units — the stepper falls back to coarse phases. */
	milestones?: ProgressStep[]
	startedAt: string | null
	completedAt: string | null
	gateOutcome: string | null
	units: HaikuUnit[]
	artifacts?: HaikuArtifact[]
	/** Stage-scoped feedback items targeting units in this stage or the
	 *  stage itself. Loaded by the detail view only. */
	feedback?: HaikuFeedback[]
	/** The per-stage user-facing BRIEF (`stages/<stage>/BRIEF.md`) — the
	 *  plain-language summary the briefer wrote before the gate. Read
	 *  server-side / by the browse provider; agents never read it. Absent
	 *  when the stage has no brief yet. */
	brief?: string | null
	/** The per-stage agent OBSERVATIONS (`stages/<stage>/observations.md`) —
	 *  the free-form reflection written at stage close. Absent until the
	 *  stage completes (or when reflection is opted out). */
	observations?: string | null
	/** The git branch for this stage (e.g. haiku/{slug}/{stage}) */
	branch?: string
	/** PR/MR URL if one exists for this stage's branch */
	prUrl?: string | null
	/** PR/MR state: "open", "merged", "closed" */
	prStatus?: string | null
	/** PR/MR number */
	prNumber?: number | null
}

/** A feedback annotation. Mirrors the on-disk v4 FB frontmatter shape
 *  (`packages/haiku/src/state/schemas/feedback.ts`) but trimmed to the
 *  fields the browse UI renders. Lifecycle is derived from the engine
 *  fields (`iterations[]`, `closed_at`) rather than a status string. */
export interface HaikuFeedback {
	/** Slug derived from the filename (e.g. "FB-03-bad-copy" → "FB-03-bad-copy"). */
	id: string
	/** Optional human-readable title from FM. Falls back to filename when absent. */
	title: string | null
	/** Origin (e.g. "user-chat", "adversarial-review", "drift", "agent"). */
	origin: string | null
	/** Author handle. */
	author: string | null
	/** Whether the FB was authored by a human or an agent. Drives the
	 *  amber-vs-stone styling in the UI. */
	authorType: "agent" | "human" | "system" | null
	/** Finding severity (`blocker` | `high` | `medium` | `low`). Review agents
	 *  classify as they file; user/SPA findings land severity-less and the
	 *  classifier fix-hat backfills it. `null` when unclassified. Drives the
	 *  fix-loop dispatch order; surfaced here as a badge + filter. */
	severity: "blocker" | "high" | "medium" | "low" | null
	/** Markdown body of the FB file (everything after the YAML frontmatter). */
	body: string
	/** Unit slug this FB targets, or null for stage/intent-scope items. */
	unit: string | null
	/** Approval roles cleared on closure (e.g. ["user", "code-reviewer"]). */
	invalidates: string[]
	/** Stamped when the terminal feedback-assessor advances. Presence = closed. */
	closedAt: string | null
	/** Stamped on create. */
	createdAt: string | null
	/** Optional closure-reply text + timestamp set by the terminal fix-hat. */
	closureReply: { text: string; at: string } | null
	/** Has the closure reply been acknowledged by the requester? */
	closureReplyUnread: boolean
	/** Cursor routing rule for this finding:
	 *    - `question`      → Track-B preempt; agent answers, no fix chain.
	 *    - `inline_fix`    → fix-hat chain runs in place against the FB body.
	 *    - `stage_revisit` → cursor walks back to the FB's stage and
	 *                        reopens its elaborate phase.
	 *  `null` when the FM hasn't declared a resolution yet (e.g. fresh
	 *  human-authored FB pre-triage). */
	resolution: "question" | "inline_fix" | "stage_revisit" | null
	/** Path on disk for reference / debugging. */
	path: string
	/** Raw FM dict for downstream consumers. */
	raw: Record<string, unknown>
}

export interface HaikuAsset {
	path: string
	name: string
	rawUrl: string
}

export interface HaikuIntentDetail extends HaikuIntent {
	stages: HaikuStageState[]
	knowledge: HaikuKnowledgeFile[]
	operations: HaikuKnowledgeFile[]
	reflection: string | null
	content: string
	assets: HaikuAsset[]
	/** Intent-scope feedback (files at `.haiku/intents/<slug>/feedback/*.md`).
	 *  Distinct from stage-scoped feedback under `stages/<stage>/feedback/`. */
	intentFeedback: HaikuFeedback[]
	/** Intent-scope approvals derived from `intent.md.approvals.*`. The
	 *  engine writes these on intent-completion gate fires; the browse
	 *  UI surfaces them so a viewer can see which roles have signed
	 *  off (spec / continuity / user / intent_quality_gates plus any
	 *  studio-defined intent-review agents). */
	intentApprovals: Array<{ role: string; signed: boolean; at: string | null }>
}

export interface CriterionItem {
	text: string
	checked: boolean
}

export interface MockupInfo {
	label: string
	url: string
}
