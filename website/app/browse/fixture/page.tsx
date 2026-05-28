"use client"

// Dev-only browse fixture — a hand-built intent that exercises the file
// discovery + rendering layer (per-directory grouping, the `(other)` bucket,
// multi-type FilePreview, and lazy unit-output previews) WITHOUT a live repo
// or a directory upload. Lets Playwright drive the real IntentDetailView and
// verify rendering. Not part of the product: it 404s outside development.

import { notFound } from "next/navigation"
import type {
	BrowseProvider,
	HaikuIntentDetail,
	HaikuUnit,
} from "@/lib/browse/types"
import { IntentDetailView } from "../components/IntentDetailView"

// A 1×1 transparent PNG as a data URL — stands in for a proof screenshot.
const PNG_DATA_URL =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const SAMPLE_TS = `export function newWorkerBadge(daysSinceJoined: number): boolean {
  const NEW_WORKER_THRESHOLD_DAYS = 14
  return daysSinceJoined <= NEW_WORKER_THRESHOLD_DAYS
}
`

const SAMPLE_FEATURE = `Feature: New worker badge
  Scenario: a worker who joined this week
    Given a worker who joined 3 days ago
    Then the "NEW" badge renders on their row
`

function fakeUnit(over: Partial<HaikuUnit>): HaikuUnit {
	return {
		name: "unit-001-render-new-tag",
		stage: "development",
		status: "completed",
		dependsOn: [],
		bolt: 1,
		hat: "builder",
		startedAt: null,
		completedAt: null,
		refs: [],
		inputs: [],
		outputs: [],
		criteria: [],
		content: "",
		raw: {},
		...over,
	}
}

const intent: HaikuIntentDetail = {
	slug: "fixture-intent",
	title: "Fixture: file rendering",
	studio: "software",
	studioStages: ["development"],
	activeStage: "development",
	mode: "continuous",
	stagesComplete: 0,
	stagesTotal: 1,
	status: "active",
	createdAt: null,
	startedAt: null,
	completedAt: null,
	composite: null,
	follows: null,
	content: "Fixture intent for exercising the browse file renderers.",
	raw: {},
	knowledge: [],
	operations: [],
	reflection: null,
	assets: [
		{ path: "proof/journey-step-1.png", name: "journey-step-1.png", rawUrl: PNG_DATA_URL },
	],
	intentFeedback: [],
	intentApprovals: [],
	stages: [
		{
			name: "development",
			status: "active",
			phase: "execute",
			startedAt: null,
			completedAt: null,
			gateOutcome: null,
			units: [
				fakeUnit({
					name: "unit-001-render-new-tag",
					outputs: [
						"web/apps/admin/src/views/Workers/WorkerDates.tsx",
						"web/apps/admin/src/views/Workers/WorkerDates.feature",
						"stages/development/artifacts/plan-unit-001.md",
						"action-log.jsonl",
					],
				}),
			],
			artifacts: [
				// proof/ — runtime-verifier screenshots (image)
				{
					name: "proof/home-desktop.png",
					type: "image",
					rawUrl: PNG_DATA_URL,
				},
				{
					name: "proof/home-mobile.png",
					type: "image",
					rawUrl: PNG_DATA_URL,
				},
				// artifacts/ — a markdown spec + an HTML mockup
				{
					name: "artifacts/screen-spec.md",
					type: "markdown",
					content:
						"# Screen spec\n\nThe **NEW** badge sits beside the join date.\n\n```ts\nconst NEW_WORKER_THRESHOLD_DAYS = 14\n```\n",
				},
				{
					name: "artifacts/mockup.html",
					type: "html",
					content:
						"<!doctype html><html><body><h1>Mockup</h1><p>NEW badge</p></body></html>",
				},
				// (other) — a stray code file + a feature file at the stage root
				{
					name: "WorkerDates.tsx",
					type: "other",
					content: SAMPLE_TS,
				},
				{
					name: "WorkerDates.feature",
					type: "other",
					content: SAMPLE_FEATURE,
				},
			],
			feedback: [],
			brief: null,
			observations: null,
		},
	],
}

// Minimal provider — only the methods IntentDetailView touches. readFile /
// resolveAssetUrl back the lazy unit-output previews.
const provider: BrowseProvider = {
	name: "Fixture",
	async listIntents() {
		return [intent]
	},
	async getIntent() {
		return intent
	},
	async readFile(path: string) {
		// Simulate the real filesystem/git provider's multi-await latency so
		// the harness reproduces async-timing bugs (e.g. an effect that
		// cancels its own in-flight read). A zero-delay fake hides them.
		await new Promise((r) => setTimeout(r, 60))
		// Project-tree outputs resolve at the path AS-IS (repo-root-relative).
		if (path === "web/apps/admin/src/views/Workers/WorkerDates.tsx")
			return SAMPLE_TS
		if (path === "web/apps/admin/src/views/Workers/WorkerDates.feature")
			return SAMPLE_FEATURE
		// Intent-relative outputs resolve ONLY under the intent dir — exercises
		// the LazyOutputPreview fallback candidate. (action-log.jsonl and the
		// plan-*.md were declared relative to the intent root.)
		if (path === ".haiku/intents/fixture-intent/action-log.jsonl")
			return '{"event":"unit_start","at":"2026-05-27T00:00:00Z"}\n{"event":"unit_done"}\n'
		if (
			path ===
			".haiku/intents/fixture-intent/stages/development/artifacts/plan-unit-001.md"
		)
			return "# Plan\n\nRender the **NEW** badge when a worker joined within the threshold.\n"
		return null
	},
	async resolveAssetUrl() {
		await new Promise((r) => setTimeout(r, 60))
		return PNG_DATA_URL
	},
	async listFiles() {
		return []
	},
	async getSettings() {
		return null
	},
}

export default function BrowseFixturePage() {
	if (process.env.NODE_ENV === "production") notFound()
	return (
		<div className="mx-auto max-w-5xl p-6">
			<IntentDetailView
				intent={intent}
				provider={provider}
				onBack={() => {}}
			/>
		</div>
	)
}
