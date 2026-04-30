// orchestrator/workflow/upstream-reconciliation.ts — Pre-elaboration
// upstream-artifact reconciliation.
//
// When a stage enters its first elaboration AND there is at least one
// completed upstream stage, walk the upstream-artifact corpus
// (`stages/<prior>/artifacts/`, `stages/<prior>/discovery/`,
// `stages/<prior>/outputs/`, `<intent>/knowledge/`, `<intent>/product/`,
// `<intent>/features/`) looking for cross-document contradictions.
//
// Three classes of divergence are detected:
//
//   1. Tool-name divergence — the same conceptual MCP tool referenced
//      by two different `haiku_*` identifiers across artifacts. We
//      detect this by clustering identifiers with high token overlap
//      whose distinct names appear under "Tool" / "tool name" headings
//      or in Tool/MCP-contract sections.
//
//   2. HTTP status code divergence — the same error code (e.g.
//      `intent_locked`, `path_outside_tracked_surface`) mapped to
//      different HTTP status numbers across artifacts.
//
//   3. Field name divergence — the same conceptual field (e.g. the
//      author identity on a feedback record) referenced by two
//      different names across schema tables.
//
// Returns null when the corpus is consistent, otherwise a finding
// list. The pre-tick hook in `run-tick.ts` translates findings into a
// `upstream_reconciliation_required` action that asks the agent to
// either reconcile the upstream artifacts (and re-tick) or
// acknowledge the divergence via `haiku_reconciliation_acknowledge`.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { intentDir } from "../../state-tools.js"

export interface ReconciliationFinding {
	kind: "tool_name" | "http_status" | "field_name"
	concept: string
	occurrences: Array<{
		name: string
		file: string
		line: number
		excerpt: string
	}>
	message: string
}

export interface ReconciliationResult {
	findings: ReconciliationFinding[]
}

/** Walk the upstream-artifact corpus for the given stage and return
 *  any cross-document contradictions. `priorStages` is the ordered
 *  list of stages that come before `currentStage` and have completed.
 *  Returns null when no findings are detected. */
export function checkUpstreamReconciliation(
	intentSlug: string,
	priorStages: readonly string[],
): ReconciliationResult | null {
	if (priorStages.length === 0) return null
	const dir = intentDir(intentSlug)
	const corpus = collectCorpus(dir, priorStages)
	if (corpus.length === 0) return null

	const findings: ReconciliationFinding[] = []
	findings.push(...detectToolNameDivergence(corpus))
	findings.push(...detectHttpStatusDivergence(corpus))
	findings.push(...detectFieldNameDivergence(corpus))

	if (findings.length === 0) return null
	return { findings }
}

/** A single text source ingested for reconciliation analysis. */
interface CorpusEntry {
	file: string
	relPath: string
	lines: string[]
}

function collectCorpus(
	intentDirPath: string,
	priorStages: readonly string[],
): CorpusEntry[] {
	const out: CorpusEntry[] = []
	const seen = new Set<string>()

	const addFile = (file: string) => {
		if (seen.has(file)) return
		seen.add(file)
		try {
			const stat = statSync(file)
			if (!stat.isFile()) return
			// Skip files larger than 256 KB — reconciliation is for
			// human-authored spec docs, not large data dumps. Anything
			// bigger is suspicious; safer to skip than to OOM.
			if (stat.size > 256 * 1024) return
		} catch {
			return
		}
		try {
			const raw = readFileSync(file, "utf8")
			const relPath = file.startsWith(`${intentDirPath}/`)
				? file.slice(intentDirPath.length + 1)
				: file
			out.push({ file, relPath, lines: raw.split("\n") })
		} catch {
			/* ignore unreadable */
		}
	}

	const walkDir = (dir: string, predicate?: (name: string) => boolean) => {
		if (!existsSync(dir)) return
		let entries: string[]
		try {
			entries = readdirSync(dir)
		} catch {
			return
		}
		for (const entry of entries) {
			const full = join(dir, entry)
			let stat: ReturnType<typeof statSync>
			try {
				stat = statSync(full)
			} catch {
				continue
			}
			if (stat.isDirectory()) {
				walkDir(full, predicate)
			} else if (stat.isFile()) {
				if (predicate && !predicate(entry)) continue
				addFile(full)
			}
		}
	}

	const isTextLike = (name: string) =>
		name.endsWith(".md") || name.endsWith(".feature") || name.endsWith(".txt")

	for (const stage of priorStages) {
		const stageDir = join(intentDirPath, "stages", stage)
		walkDir(join(stageDir, "artifacts"), isTextLike)
		walkDir(join(stageDir, "discovery"), isTextLike)
		walkDir(join(stageDir, "outputs"), isTextLike)
	}
	walkDir(join(intentDirPath, "knowledge"), isTextLike)
	walkDir(join(intentDirPath, "product"), isTextLike)
	walkDir(join(intentDirPath, "features"), isTextLike)

	return out
}

// ── Detector 1: tool-name divergence ──────────────────────────────────────

const TOOL_HEADING_RE =
	/(?:^|\s)(?:tool|tool[- ]name|mcp[- ]tool|tool[- ]contract)[\s:]/i

/** Identifier that looks like an MCP tool (haiku_<lowercase_underscore>). */
const HAIKU_TOOL_RE = /\bhaiku_[a-z][a-z0-9_]*\b/g

/** Cluster two haiku_* identifiers as "same conceptual tool" when:
 *  - they share at least one non-leading token (e.g. `haiku_feedback_write`
 *    and `haiku_feedback_create` both share `feedback`), AND
 *  - one or both appear in tool-contract context lines (Tool: header,
 *    "the haiku_X tool" prose, MCP contract sections).
 *
 * We're conservative here — the goal is to surface the obvious
 * "your storage doc says haiku_feedback_write but your API doc says
 * haiku_feedback_create" case, not every coincidence of shared tokens.
 */
function detectToolNameDivergence(
	corpus: CorpusEntry[],
): ReconciliationFinding[] {
	const findings: ReconciliationFinding[] = []
	// occurrences keyed by conceptual cluster (sorted shared-token signature)
	const clusters = new Map<
		string,
		Map<string, Array<{ file: string; line: number; excerpt: string }>>
	>()

	for (const entry of corpus) {
		for (let i = 0; i < entry.lines.length; i++) {
			const line = entry.lines[i]
			const inToolContext =
				TOOL_HEADING_RE.test(line) ||
				/\btool\b/i.test(line) ||
				/\bmcp\b/i.test(line)
			if (!inToolContext) continue
			const matches = line.match(HAIKU_TOOL_RE)
			if (!matches) continue
			for (const tool of matches) {
				const tokens = tool
					.split("_")
					.slice(1)
					.filter((t) => t.length >= 3)
				if (tokens.length === 0) continue
				// Cluster by the FIRST meaningful token after `haiku_` —
				// e.g. `haiku_feedback_write` and `haiku_feedback_create`
				// both cluster under `feedback`. This catches the
				// "same conceptual tool, different verb" case the
				// detector exists to surface.
				const sig = tokens[0]
				if (!sig) continue
				const cluster = clusters.get(sig) ?? new Map()
				if (!clusters.has(sig)) clusters.set(sig, cluster)
				const occList = cluster.get(tool) ?? []
				if (!cluster.has(tool)) cluster.set(tool, occList)
				occList.push({
					file: entry.relPath,
					line: i + 1,
					excerpt: line.trim().slice(0, 200),
				})
			}
		}
	}

	for (const [sig, cluster] of clusters) {
		if (cluster.size < 2) continue
		// Only surface when the variants appear in DIFFERENT files —
		// same-file variation is usually intentional (e.g. listing all
		// feedback tools side by side).
		const allFiles = new Set<string>()
		for (const occList of cluster.values()) {
			for (const o of occList) allFiles.add(o.file)
		}
		if (allFiles.size < 2) continue

		const occurrences: ReconciliationFinding["occurrences"] = []
		for (const [name, occList] of cluster) {
			for (const o of occList) {
				occurrences.push({
					name,
					file: o.file,
					line: o.line,
					excerpt: o.excerpt,
				})
			}
		}
		findings.push({
			kind: "tool_name",
			concept: sig,
			occurrences,
			message: `Tool-name divergence on concept "${sig}": ${[...cluster.keys()].join(", ")} appear across ${allFiles.size} upstream artifact(s). Pick one canonical name, update the artifacts that disagree, and re-run the workflow tick — or acknowledge the divergence via haiku_reconciliation_acknowledge if the artifacts intentionally describe different tools.`,
		})
	}

	return findings
}

// ── Detector 2: HTTP status code divergence ────────────────────────────────

/** Match patterns like "`intent_locked` → 423" or "intent_locked: 423"
 *  or "intent_locked | 423" or table cells joining a code label and a
 *  status number. */
const STATUS_CODE_RE =
	/`?([a-z][a-z0-9_]{3,})`?\s*(?:[→\->|:]|\|)\s*(\d{3})\b/gi

function detectHttpStatusDivergence(
	corpus: CorpusEntry[],
): ReconciliationFinding[] {
	const findings: ReconciliationFinding[] = []
	const map = new Map<
		string,
		Map<string, Array<{ file: string; line: number; excerpt: string }>>
	>()

	for (const entry of corpus) {
		for (let i = 0; i < entry.lines.length; i++) {
			const line = entry.lines[i]
			// Cheap pre-filter: line must mention an HTTP-shaped status
			// (3xx/4xx/5xx) AND a snake_case identifier. Skips most prose.
			if (!/\b[345]\d{2}\b/.test(line)) continue
			STATUS_CODE_RE.lastIndex = 0
			const matches = [...line.matchAll(STATUS_CODE_RE)]
			for (const m of matches) {
				const code = m[1].toLowerCase()
				const status = m[2]
				// Only meaningful 3xx-5xx codes.
				if (!/^[345]\d{2}$/.test(status)) continue
				// Skip codes that are just numbers ("200_ok") to reduce noise.
				if (/^\d+_/.test(code)) continue
				// Skip very common English words that look like codes.
				if (
					code === "from" ||
					code === "with" ||
					code === "this" ||
					code === "when" ||
					code === "that" ||
					code === "there" ||
					code === "where" ||
					code === "must" ||
					code === "have" ||
					code === "make" ||
					code === "what"
				) {
					continue
				}
				const byStatus = map.get(code) ?? new Map()
				if (!map.has(code)) map.set(code, byStatus)
				const occList = byStatus.get(status) ?? []
				if (!byStatus.has(status)) byStatus.set(status, occList)
				occList.push({
					file: entry.relPath,
					line: i + 1,
					excerpt: line.trim().slice(0, 200),
				})
			}
		}
	}

	for (const [code, byStatus] of map) {
		if (byStatus.size < 2) continue
		// Cross-file requirement to avoid same-file revision noise.
		const allFiles = new Set<string>()
		for (const occList of byStatus.values()) {
			for (const o of occList) allFiles.add(o.file)
		}
		if (allFiles.size < 2) continue

		const occurrences: ReconciliationFinding["occurrences"] = []
		for (const [status, occList] of byStatus) {
			for (const o of occList) {
				occurrences.push({
					name: `${code} → ${status}`,
					file: o.file,
					line: o.line,
					excerpt: o.excerpt,
				})
			}
		}
		findings.push({
			kind: "http_status",
			concept: code,
			occurrences,
			message: `HTTP status divergence on error code "${code}": mapped to ${[...byStatus.keys()].join(", ")} across ${allFiles.size} upstream artifact(s). Pick one canonical mapping, update the artifacts that disagree, and re-run the workflow tick — or acknowledge the divergence via haiku_reconciliation_acknowledge if the artifacts intentionally describe different responses.`,
		})
	}

	return findings
}

// ── Detector 3: field-name divergence ──────────────────────────────────────

/** Heuristic field-name pairs we treat as "same concept, different
 *  spelling". Conservative list — only the patterns we've actually seen
 *  bite. Adding new entries is cheap; false positives are not. */
const FIELD_SYNONYMS: Array<readonly [string, string, string]> = [
	["acknowledged_by", "author_class", "feedback author identity"],
	["acknowledged_by", "author_type", "feedback author identity"],
	["author_class", "author_type", "feedback author identity"],
	["created_at", "started_at", "record-creation timestamp"],
	["finished_at", "completed_at", "record-completion timestamp"],
	["closed_at", "completed_at", "lifecycle terminal timestamp"],
]

const FIELD_DEF_RE =
	/(?:^|[\s|`(])([a-z][a-z0-9_]{3,})(?:`|\s)?\s*(?::|\||→|->)\s*\S/gi

function detectFieldNameDivergence(
	corpus: CorpusEntry[],
): ReconciliationFinding[] {
	const findings: ReconciliationFinding[] = []
	// For each known synonym pair, collect occurrences by file.
	for (const [a, b, concept] of FIELD_SYNONYMS) {
		const occA: Array<{ file: string; line: number; excerpt: string }> = []
		const occB: Array<{ file: string; line: number; excerpt: string }> = []
		for (const entry of corpus) {
			for (let i = 0; i < entry.lines.length; i++) {
				const line = entry.lines[i]
				FIELD_DEF_RE.lastIndex = 0
				for (const m of line.matchAll(FIELD_DEF_RE)) {
					const name = m[1].toLowerCase()
					if (name === a) {
						occA.push({
							file: entry.relPath,
							line: i + 1,
							excerpt: line.trim().slice(0, 200),
						})
					} else if (name === b) {
						occB.push({
							file: entry.relPath,
							line: i + 1,
							excerpt: line.trim().slice(0, 200),
						})
					}
				}
			}
		}
		if (occA.length === 0 || occB.length === 0) continue
		// Require cross-file divergence.
		const filesA = new Set(occA.map((o) => o.file))
		const filesB = new Set(occB.map((o) => o.file))
		const union = new Set([...filesA, ...filesB])
		if (union.size < 2) continue

		const occurrences: ReconciliationFinding["occurrences"] = []
		for (const o of occA) {
			occurrences.push({
				name: a,
				file: o.file,
				line: o.line,
				excerpt: o.excerpt,
			})
		}
		for (const o of occB) {
			occurrences.push({
				name: b,
				file: o.file,
				line: o.line,
				excerpt: o.excerpt,
			})
		}
		findings.push({
			kind: "field_name",
			concept,
			occurrences,
			message: `Field-name divergence on concept "${concept}": "${a}" and "${b}" appear across ${union.size} upstream artifact(s). Pick one canonical name, update the artifacts that disagree, and re-run the workflow tick — or acknowledge the divergence via haiku_reconciliation_acknowledge if the artifacts intentionally describe different fields.`,
		})
	}
	return findings
}
