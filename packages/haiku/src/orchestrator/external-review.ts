// orchestrator/external-review.ts — External review state detection
// + changes-requested handling.
//
// Two-tier signal detection for external/await gates:
//
// Tier 1: Branch merge detection (structural). In git workflows,
//   external review gates use a stage branch (`haiku/{slug}/{stage}`)
//   that gets merged into the intent hub (`haiku/{slug}/main`) when
//   the review is approved. `isBranchMerged()` (in git-worktree)
//   detects this — including squash merges. Tamper-resistant: the
//   merge is a structural fact, not something the agent can
//   self-assert. Lives in the gate handler that consumes this module.
//
// Tier 2: URL-based CLI probing (fallback). `checkExternalState`
//   shells out to `gh` or `glab` to check PR/MR status when a review
//   URL was recorded. Used when branch detection is unavailable
//   (non-git workflows) or as a secondary check.
//
// `handleExternalChangesRequested` runs when Tier 2 returns
// "changes_requested": creates a feedback file, rolls the stage
// back to elaborate, emits telemetry, and returns the orchestrator
// action.

import { execFileSync } from "node:child_process"
import type { OrchestratorAction } from "../orchestrator.js"
import { maybeEscalate } from "../orchestrator.js"
import {
	appendStageIteration,
	gitCommitState,
	readJson,
	stageStatePath,
	writeFeedbackFile,
	writeJson,
} from "../state-tools.js"
import { emitTelemetry } from "../telemetry.js"

/** Result from checking external review state.
 *  `status` describes the review state:
 *    - `approved`          — reviews approved or PR/MR merged
 *    - `changes_requested` — reviewer requested changes
 *    - `pending`           — no definitive review decision yet
 *    - `unknown`           — CLI not available, network error, or unrecognised URL */
export interface ExternalReviewState {
	status: "approved" | "changes_requested" | "pending" | "unknown"
	provider?: "github" | "gitlab"
	url?: string
}

/** Tier 2 (fallback): URL-based synchronous check of external review
 *  state. Supports GitHub PRs (gh) and GitLab MRs (glab). */
export function checkExternalState(url: string): ExternalReviewState {
	try {
		if (url.includes("github.com") && url.includes("/pull/")) {
			// GitHub PR — check review decision AND merge state (argument array avoids shell injection)
			const output = execFileSync(
				"gh",
				[
					"pr",
					"view",
					url,
					"--json",
					"state,reviewDecision",
					"-q",
					"[.state, .reviewDecision]",
				],
				{ encoding: "utf8", stdio: "pipe", timeout: 15000 },
			).trim()
			const parsed = JSON.parse(output) as [string, string]
			const [state, reviewDecision] = parsed
			if (state === "MERGED" || reviewDecision === "APPROVED") {
				return { status: "approved", provider: "github", url }
			}
			if (reviewDecision === "CHANGES_REQUESTED") {
				return { status: "changes_requested", provider: "github", url }
			}
			// REVIEW_REQUIRED, COMMENTED, or empty — no definitive decision yet
			return { status: "pending", provider: "github", url }
		}
		if (url.includes("gitlab") && url.includes("/merge_requests/")) {
			// GitLab MR — check via glab CLI (argument array avoids shell injection)
			const output = execFileSync(
				"glab",
				["mr", "view", url, "--output", "json"],
				{ encoding: "utf8", stdio: "pipe", timeout: 15000 },
			).trim()
			const mr = JSON.parse(output) as {
				state?: string
				approved?: boolean
			}
			if (mr.state === "merged" || mr.approved === true) {
				return { status: "approved", provider: "gitlab", url }
			}
			// GitLab: approved === false on an open MR means changes requested
			if (mr.state === "opened" && mr.approved === false) {
				return { status: "changes_requested", provider: "gitlab", url }
			}
			return { status: "pending", provider: "gitlab", url }
		}
		// Unknown URL type — can't check via CLI
		return { status: "unknown" }
	} catch {
		// CLI not available, timeout, or network error
		return { status: "unknown" }
	}
}

/** Handle the "changes_requested" outcome from an external review.
 *  Creates a feedback file, rolls the workflow back to elaborate,
 *  emits telemetry, and returns the orchestrator action. */
export function handleExternalChangesRequested(
	slug: string,
	currentStage: string,
	externalUrl: string,
	provider: "github" | "gitlab" | undefined,
): OrchestratorAction {
	const originType = provider === "gitlab" ? "external-mr" : "external-pr"
	const fbResult = writeFeedbackFile(slug, currentStage, {
		title: "External review requested changes",
		body: `The external review at ${externalUrl} requested changes. Review the PR/MR comments and address the reviewer's feedback before re-submitting for review.`,
		origin: originType,
		author: "user",
		source_ref: externalUrl,
	})
	gitCommitState(
		`feedback: create ${fbResult.feedback_id} from external review in ${currentStage}`,
	)

	// Roll workflow back to elaborate for a revisit cycle
	const statePath = stageStatePath(slug, currentStage)
	const stateData = readJson(statePath)
	stateData.status = "active"
	stateData.phase = "elaborate"
	stateData.gate_outcome = null
	writeJson(statePath, stateData)
	const iterResult = appendStageIteration(
		slug,
		currentStage,
		{
			trigger: "external-changes",
			reason: `External review at ${externalUrl} requested changes`,
			feedbackTitles: [fbResult.feedback_id],
		},
		"external-changes",
	)
	gitCommitState(
		`revisit ${currentStage}: external changes requested (iteration ${iterResult.count})`,
	)

	emitTelemetry("haiku.gate.resolved", {
		intent: slug,
		stage: currentStage,
		gate_type: "external",
		outcome: "changes_requested",
	})

	const escalateResult = maybeEscalate(
		slug,
		currentStage,
		iterResult,
		"external-changes",
	)
	if (escalateResult) return escalateResult

	return {
		action: "external_changes_requested",
		intent: slug,
		stage: currentStage,
		external_review_url: externalUrl,
		provider,
		feedback_id: fbResult.feedback_id,
		feedback_file: fbResult.file,
		iteration: iterResult.count,
		visits: iterResult.count, // legacy alias — prefer `iteration`
		message: `External review at ${externalUrl} requested changes. Created ${fbResult.feedback_id} and rolled back to elaborate phase (iteration ${iterResult.count}). Address the reviewer's feedback, then call haiku_run_next to continue.`,
	}
}
