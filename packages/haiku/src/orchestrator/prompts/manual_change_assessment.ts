// orchestrator/prompts/manual_change_assessment.ts — Pre-tick drift gate.
//
// Fires when the drift-detection gate detects one or more files in the
// tracked surface whose SHA-256 has changed since the last baseline
// acknowledgment. The agent must classify each finding before the normal
// stage handler runs.
//
// Action shape (emitted by drift-detection-gate.ts):
//   { action: "manual_change_assessment", findings: DriftFinding[], slug: string }
//
// Classification protocol: agent calls `haiku_classify_drift` with one
// classification per finding. The four outcomes are:
//   - `ignore` — accept the change; baseline updates immediately.
//   - `inline-fix` — absorb into the current bolt; baseline updates immediately.
//   - `surface-as-feedback` — create a feedback item; baseline holds (pending
//     marker) until the feedback reaches a terminal state.
//   - `trigger-revisit` — revisit the owning stage; baseline holds until the
//     revisit completes. Not legal for current-stage findings.
//
// The OOM path (`is_baseline_oom: true`) bypasses per-finding classification
// and tells the agent to call `haiku_baseline_init` to re-establish the whole
// surface against the current worktree.

import { definePromptBuilder } from "./define.js"

interface DriftFinding {
	path: string
	change_kind: "new-file-detected" | "modified" | "file-removed"
	is_binary: boolean
	diff_unified: string | null
	before_sha256: string | null
	after_sha256: string | null
	before_bytes: number | null
	after_bytes: number | null
	tracking_class: string
	stage: string | null
	context_unit: string | null
	is_baseline_oom?: boolean
}

function formatFinding(finding: DriftFinding, index: number): string {
	const lines: string[] = []

	const kindLabel: Record<string, string> = {
		"new-file-detected": "New file",
		modified: "Modified",
		"file-removed": "Deleted",
	}
	const kind = kindLabel[finding.change_kind] ?? finding.change_kind
	const binaryNote = finding.is_binary ? " (binary)" : ""

	lines.push(`#### ${index + 1}. \`${finding.path}\` — ${kind}${binaryNote}`)

	if (finding.before_sha256 !== null) {
		lines.push(`- Before SHA-256: \`${finding.before_sha256.slice(0, 16)}…\``)
	}
	if (finding.after_sha256 !== null) {
		lines.push(`- After SHA-256:  \`${finding.after_sha256.slice(0, 16)}…\``)
	}
	if (finding.before_bytes !== null && finding.after_bytes !== null) {
		lines.push(`- Size: ${finding.before_bytes} → ${finding.after_bytes} bytes`)
	} else if (finding.after_bytes !== null) {
		lines.push(`- Size: ${finding.after_bytes} bytes (new file)`)
	} else if (finding.before_bytes !== null) {
		lines.push(`- Size: ${finding.before_bytes} bytes (deleted)`)
	}
	if (finding.tracking_class) {
		lines.push(`- Tracking class: \`${finding.tracking_class}\``)
	}

	if (finding.diff_unified) {
		lines.push("", "```diff", finding.diff_unified, "```")
	} else if (!finding.is_binary && finding.change_kind !== "file-removed") {
		lines.push(
			"- _No unified diff available (git history unreachable for this SHA)._",
		)
	}

	return lines.join("\n")
}

export default definePromptBuilder(({ slug, action }) => {
	const findings = (action.findings as DriftFinding[]) || []

	if (findings.length === 0) {
		return [
			"## Manual Change Assessment",
			"",
			"The drift-detection gate fired but produced no findings. This is unexpected.",
			"Call `haiku_run_next` to retry.",
		].join("\n")
	}

	const isOom = findings.length === 1 && findings[0].is_baseline_oom === true

	if (isOom) {
		const stage = findings[0].stage ?? "unknown"
		return [
			"## Manual Change Assessment — Baseline Out-of-Sync",
			"",
			`More than 50% of the tracked surface for stage \`${stage}\` has drifted from the baseline. ` +
				"This typically indicates a large-scale human replacement or an out-of-band sync event.",
			"",
			"**Required action:**",
			"",
			"Call `haiku_baseline_init` to re-establish the baseline against the current worktree state " +
				"before proceeding. This acknowledges all current files as the new baseline.",
			"",
			"If the changes represent unreviewed human work that should be classified individually, " +
				"restore the prior baseline manually and classify each file one at a time.",
			"",
			`Once the baseline is updated, call \`haiku_run_next { intent: "${slug}" }\`.`,
		].join("\n")
	}

	const findingBlocks = findings.map(formatFinding).join("\n\n")

	return [
		"## Manual Change Assessment Required",
		"",
		`The pre-tick drift-detection gate detected **${findings.length} change${findings.length !== 1 ? "s" : ""}** ` +
			"in the tracked surface since the last baseline acknowledgment.",
		"",
		"You must classify every finding below before the normal stage handler can run.",
		"",
		"### Findings",
		"",
		findingBlocks,
		"",
		"### Classification protocol",
		"",
		"Classify EVERY finding by calling `haiku_classify_drift` with one classification per finding. The four valid outcomes are:",
		"",
		"- `ignore` — change observed, accept it; baseline updates immediately.",
		"- `inline-fix` — absorb the change into the current bolt; baseline updates immediately.",
		"- `surface-as-feedback` — open a feedback item; baseline holds (pending-marker written) until the feedback reaches a terminal state (`closed` or `rejected`).",
		"- `trigger-revisit` — revisit the owning stage; baseline holds until the revisit completes. Not legal for current-stage findings.",
		"",
		"Per-finding allowed outcomes are listed in the action's `legal_outcomes` map — each finding accepts only the outcomes whose key is its `path`. Pick from that subset.",
		"",
		`When every finding is classified, call \`haiku_run_next { intent: "${slug}" }\`.`,
	].join("\n")
})
