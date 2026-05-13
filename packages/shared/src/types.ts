// Shared H·AI·K·U types used by both the website and review-app

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
	startedAt: string | null
	completedAt: string | null
	gateOutcome: string | null
	units: HaikuUnit[]
	artifacts?: HaikuArtifact[]
	/** Stage-scoped feedback items targeting units in this stage or the
	 *  stage itself. Loaded by the detail view only. */
	feedback?: HaikuFeedback[]
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
}

export interface CriterionItem {
	text: string
	checked: boolean
}

export interface MockupInfo {
	label: string
	url: string
}
