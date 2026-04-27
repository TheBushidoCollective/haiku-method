// orchestrator/validators.ts — Workflow-engine validators that run
// at phase transitions and block advancement on violations.
//
// Each validator returns either a concrete OrchestratorAction
// describing the violation (which the workflow handler emits to the
// agent), or null when the check passes.
//
// Concerns covered:
//   - validateStageOutputs        — required outputs exist post-execute
//   - validateDiscoveryArtifacts  — discovery artifacts exist post-elaborate
//   - validateUnitNaming          — unit-NN-slug.md naming convention
//   - validateUnitInputs          — every unit declares `inputs:`
//   - runQualityGates             — execute the gate commands at unit completion
//   - writeReviewFeedbackFiles    — persist review-UI feedback to feedback files
//   - buildOutputRequirements     — render the output-requirements prompt block

import { execSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import matter from "gray-matter"
import { resolvePluginRoot } from "../config.js"
import type { OrchestratorAction } from "../orchestrator.js"
import { resolveStudioFilePath } from "../orchestrator.js"
import {
	findHaikuRoot,
	gitCommitState,
	parseFrontmatter,
	writeFeedbackFile,
} from "../state-tools.js"
import { readStageArtifactDefs } from "../studio-reader.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

// ── Output validation ─────────────────────────────────────────────────────

/** Validate that required stage outputs were created during execution.
 *  Returns an error action if outputs are missing, null if all present. */
export function validateStageOutputs(
	slug: string,
	stage: string,
	studio: string,
): OrchestratorAction | null {
	const pluginRoot = resolvePluginRoot()

	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const outputsDir = join(base, studio, "stages", stage, "outputs")
		if (!existsSync(outputsDir)) continue

		const outputDefs = readdirSync(outputsDir).filter((f) => f.endsWith(".md"))
		const missing: Array<{ name: string; location: string }> = []

		for (const f of outputDefs) {
			const raw = readFileSync(join(outputsDir, f), "utf8")
			const { data } = matter(raw)
			const required = data.required !== false // default true
			if (!required) continue

			const location = (data.location as string) || ""
			if (!location) continue

			// Skip project-tree outputs (code, deployment configs) — can't validate a specific path
			if (location.startsWith("(")) continue

			// Resolve location with intent slug
			const resolved = location.replace("{intent-slug}", slug)
			const absPath = join(process.cwd(), resolved)

			if (resolved.endsWith("/")) {
				if (
					!existsSync(absPath) ||
					readdirSync(absPath).filter((e) => e !== ".gitkeep").length === 0
				) {
					missing.push({ name: (data.name as string) || f, location: resolved })
				}
			} else {
				if (!existsSync(absPath)) {
					missing.push({ name: (data.name as string) || f, location: resolved })
				}
			}
		}

		if (missing.length > 0) {
			return {
				action: "outputs_missing",
				intent: slug,
				stage,
				missing,
				message: `Cannot advance to review: ${missing.length} required output(s) not found.\n${missing.map((m) => `- ${m.name}: expected at ${m.location}`).join("\n")}\n\nThe execution phase must produce these artifacts. Go back and create them, then call haiku_run_next again.`,
			}
		}
		break // Project-level outputs dir takes precedence over plugin-level (first match wins)
	}

	return null
}

// ── Review feedback writer helper ────────────────────────────────────────

/** Write feedback files from a review-UI changes_requested result.
 *  Extracts annotation pins, inline comments, and free-form feedback
 *  text into individual feedback files with appropriate origins.
 *  Returns the list of created feedback IDs. */
export function writeReviewFeedbackFiles(
	slug: string,
	stage: string,
	reviewResult: { feedback?: string; annotations?: unknown },
): string[] {
	const createdIds: string[] = []
	const annotations = reviewResult.annotations as
		| {
				pins?: Array<{ x: number; y: number; text: string }>
				comments?: Array<{
					selectedText: string
					comment: string
					paragraph: number
					location?: string
				}>
				screenshot?: string
		  }
		| undefined

	if (annotations?.pins) {
		for (const pin of annotations.pins) {
			if (!pin.text) continue
			const title =
				pin.text.length > 120 ? `${pin.text.slice(0, 117)}...` : pin.text
			const result = writeFeedbackFile(slug, stage, {
				title,
				body: pin.text,
				origin: "user-visual",
				author: "user",
				source_ref: `pin:${pin.x},${pin.y}`,
			})
			createdIds.push(result.feedback_id)
		}
	}

	if (annotations?.comments) {
		for (const comment of annotations.comments) {
			if (!comment.comment) continue
			const title =
				comment.comment.length > 120
					? `${comment.comment.slice(0, 117)}...`
					: comment.comment
			const quoted = comment.selectedText
				? comment.selectedText
						.split("\n")
						.map((l) => `> ${l}`)
						.join("\n")
				: ""
			const locationLine = comment.location
				? `**Location:** \`${comment.location}\` (paragraph ${comment.paragraph})`
				: `**Location:** paragraph ${comment.paragraph}`
			const bodyParts = [locationLine]
			if (quoted) {
				bodyParts.push("", "**Selected text:**", "", quoted)
			}
			bodyParts.push("", "**Comment:**", "", comment.comment)
			const body = bodyParts.join("\n")
			const srcRefBase = comment.location
				? `${comment.location}:paragraph=${comment.paragraph}`
				: `paragraph:${comment.paragraph}`
			const result = writeFeedbackFile(slug, stage, {
				title,
				body,
				origin: "user-visual",
				author: "user",
				source_ref: srcRefBase,
			})
			createdIds.push(result.feedback_id)
		}
	}

	if (reviewResult.feedback?.trim()) {
		const fb = reviewResult.feedback.trim()
		const title = fb.length > 120 ? `${fb.slice(0, 117)}...` : fb
		const result = writeFeedbackFile(slug, stage, {
			title,
			body: fb,
			origin: "user-chat",
			author: "user",
		})
		createdIds.push(result.feedback_id)
	}

	if (createdIds.length > 0) {
		gitCommitState(
			stage
				? `feedback: create ${createdIds.join(", ")} from review UI in ${stage}`
				: `feedback: create ${createdIds.join(", ")} from review UI (intent-scope)`,
		)
	}

	return createdIds
}

// ── Output template injection ────────────────────────────────────────────

/** Build a compact output-requirements block. Lists each output
 *  artifact's name/location/format + a PATH to the full template
 *  (never inlines the template body). Subagent reads the template
 *  file directly if it needs the detail — keeps main-agent AND
 *  subagent contexts small. Returns "" if no output artifacts are
 *  defined. */
export function buildOutputRequirements(
	studio: string,
	stage: string,
	heading = "## Output Requirements",
): string {
	const artifactDefs = readStageArtifactDefs(studio, stage)
	const outputDefs = artifactDefs.filter((d) => d.kind === "output")
	if (outputDefs.length === 0) return ""
	const parts = [
		heading,
		"Full template bodies live at the paths below — read each one you're expected to produce.",
		"",
	]
	for (const od of outputDefs) {
		const templatePath = resolveStudioFilePath(
			join(studio, "stages", stage, "outputs", `${od.name}.md`),
		)
		const pathHint = templatePath ? ` | **Template:** \`${templatePath}\`` : ""
		parts.push(
			`- **${od.name}**${od.required ? " (REQUIRED)" : ""} — location: \`${od.location}\`, format: ${od.format}${pathHint}`,
		)
	}
	return parts.join("\n")
}

// ── Discovery artifact validation ────────────────────────────────────────

/** Validate that required discovery artifacts exist before advancing
 *  from elaborate to execute. Reads discovery definitions from
 *  studios/{studio}/stages/{stage}/discovery/ and checks that each
 *  required artifact exists at its specified location. */
export function validateDiscoveryArtifacts(
	slug: string,
	stage: string,
	studio: string,
): OrchestratorAction | null {
	const pluginRoot = resolvePluginRoot()

	for (const base of [
		join(process.cwd(), ".haiku", "studios"),
		join(pluginRoot, "studios"),
	]) {
		const discoveryDir = join(base, studio, "stages", stage, "discovery")
		if (!existsSync(discoveryDir)) continue

		const discoveryDefs = readdirSync(discoveryDir).filter((f) =>
			f.endsWith(".md"),
		)
		const missing: Array<{ name: string; location: string }> = []

		for (const f of discoveryDefs) {
			const raw = readFileSync(join(discoveryDir, f), "utf8")
			const { data } = matter(raw)
			const required = data.required !== false // default true
			if (!required) continue

			const location = (data.location as string) || ""
			if (!location) continue

			if (location.startsWith("(")) continue

			const resolved = location.replace("{intent-slug}", slug)
			const absPath = join(process.cwd(), resolved)

			if (resolved.endsWith("/")) {
				if (
					!existsSync(absPath) ||
					readdirSync(absPath).filter((e) => e !== ".gitkeep").length === 0
				) {
					missing.push({ name: (data.name as string) || f, location: resolved })
				}
			} else {
				if (!existsSync(absPath)) {
					missing.push({ name: (data.name as string) || f, location: resolved })
				}
			}
		}

		if (missing.length > 0) {
			return {
				action: "discovery_missing",
				intent: slug,
				stage,
				missing,
				message: `Cannot advance to execution: ${missing.length} required discovery artifact(s) not found.\n${missing.map((m) => `- ${m.name}: expected at ${m.location}`).join("\n")}\n\nThe elaboration phase must produce these artifacts. Go back and create them, then call haiku_run_next again.`,
			}
		}
		break
	}

	return null
}

// ── Unit naming validation ──────────────────────────────────────────────

const UNIT_NAMING_PATTERN = /^unit-\d{2,}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

/** Validate unit file naming convention in a stage. Files MUST match
 *  `unit-NN-slug.md` (e.g., unit-01-data-model.md). */
export function validateUnitNaming(
	intentDirPath: string,
	stage: string,
): OrchestratorAction | null {
	const unitsDir = join(intentDirPath, "stages", stage, "units")
	if (!existsSync(unitsDir)) return null

	const allFiles = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
	if (allFiles.length === 0) return null

	const violations: Array<{ file: string; issue: string }> = []
	const seenNumbers = new Map<number, string>()

	for (const f of allFiles) {
		if (!UNIT_NAMING_PATTERN.test(f)) {
			if (!f.startsWith("unit-")) {
				violations.push({ file: f, issue: "must start with 'unit-'" })
			} else if (!/^unit-\d+/.test(f)) {
				violations.push({
					file: f,
					issue:
						"must have a zero-padded number after 'unit-' (e.g., unit-01-...)",
				})
			} else if (!/^unit-\d{2,}/.test(f)) {
				violations.push({
					file: f,
					issue:
						"number must be zero-padded to at least 2 digits (e.g., 01, 02)",
				})
			} else {
				violations.push({
					file: f,
					issue:
						"slug must be kebab-case (lowercase letters, numbers, hyphens). Expected: unit-NN-slug.md",
				})
			}
			continue
		}

		const numMatch = f.match(/^unit-(\d+)/)
		if (numMatch) {
			const num = Number.parseInt(numMatch[1], 10)
			if (seenNumbers.has(num)) {
				violations.push({
					file: f,
					issue: `duplicate number ${numMatch[1]} (also used by ${seenNumbers.get(num)})`,
				})
			} else {
				seenNumbers.set(num, f)
			}
		}
	}

	if (violations.length > 0) {
		const slug = intentDirPath.split("/intents/")[1] || ""
		return {
			action: "unit_naming_invalid",
			intent: slug,
			stage,
			violations,
			message: `${violations.length} unit file(s) have invalid naming in stage '${stage}'. Files MUST be named \`unit-NN-slug.md\` (e.g., \`unit-01-data-model.md\`):\n\n${violations.map((v) => `- \`${v.file}\`: ${v.issue}`).join("\n")}\n\nRename the files to match the convention, then call \`haiku_run_next { intent: "${slug}" }\` again.`,
		}
	}

	return null
}

// ── Unit inputs validation ───────────────────────────────────────────────

/** Validate that all units in a stage have a non-empty `inputs:`
 *  field. Every unit must declare what upstream artifacts it
 *  references. */
export function validateUnitInputs(
	intentDirPath: string,
	stage: string,
): OrchestratorAction | null {
	const unitsDir = join(intentDirPath, "stages", stage, "units")
	if (!existsSync(unitsDir)) return null

	const unitFiles = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
	if (unitFiles.length === 0) return null

	const missing: string[] = []
	for (const f of unitFiles) {
		const fm = readFrontmatter(join(unitsDir, f))
		const status = (fm.status as string) || ""
		if (["complete", "skipped", "failed"].includes(status)) continue
		const inputs = (fm.inputs as string[]) || (fm.refs as string[]) || []
		if (inputs.length === 0) {
			missing.push(f.replace(/\.md$/, ""))
		}
	}

	if (missing.length > 0) {
		const slug = intentDirPath.split("/intents/")[1] || ""
		return {
			action: "unit_inputs_missing",
			intent: slug,
			stage,
			missing_units: missing,
			message: `Cannot advance to execution: ${missing.length} unit(s) have no \`inputs:\` field.\n\nEvery unit MUST declare its inputs — the upstream artifacts, knowledge docs, and prior-stage outputs it references. At minimum, include the intent document and discovery docs.\n\nUnits missing inputs:\n${missing.map((u) => `- ${u}`).join("\n")}\n\nAdd \`inputs:\` to each unit's frontmatter with paths relative to the intent directory (e.g., \`knowledge/DISCOVERY.md\`, \`stages/design/DESIGN-BRIEF.md\`), then call \`haiku_run_next { intent: "${slug}" }\` again.`,
		}
	}

	return null
}

// ── Quality gate runner ───────────────────────────────────────────────────

interface QualityGateResult {
	name: string
	command: string
	dir: string
	exit_code: number
	output: string
}

/** Read quality_gates from intent.md and all unit files in a stage,
 *  execute each gate command, and return failures. */
export function runQualityGates(
	slug: string,
	stage: string,
): QualityGateResult[] {
	const root = findHaikuRoot()
	const iDir = join(root, "intents", slug)
	const intentFile = join(iDir, "intent.md")

	let repoRoot: string
	try {
		repoRoot = execSync("git rev-parse --show-toplevel", {
			encoding: "utf8",
		}).trim()
	} catch {
		repoRoot = process.cwd()
	}

	function parseGates(
		filePath: string,
	): Array<{ name: string; command: string; dir: string }> {
		const data = readFrontmatter(filePath)
		const raw = Array.isArray(data.quality_gates) ? data.quality_gates : []
		return raw
			.filter(
				(g: Record<string, unknown>): g is Record<string, string> =>
					!!g?.command,
			)
			.map((g: Record<string, string>) => ({
				name: g.name ?? "",
				command: g.command,
				dir: g.dir ?? "",
			}))
	}

	const allGates = parseGates(intentFile)
	const unitsDir = join(iDir, "stages", stage, "units")
	if (existsSync(unitsDir)) {
		for (const f of readdirSync(unitsDir).filter(
			(f) => f.startsWith("unit-") && f.endsWith(".md"),
		)) {
			allGates.push(...parseGates(join(unitsDir, f)))
		}
	}

	const seen = new Set<string>()
	const uniqueGates = allGates.filter((g) => {
		const key = `${g.command}::${g.dir}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	// Execute each gate. Timeout default 120s; override via
	// HAIKU_QUALITY_GATE_TIMEOUT_MS. 500-char output truncation.
	const gateTimeoutMs = (() => {
		const raw = process.env.HAIKU_QUALITY_GATE_TIMEOUT_MS
		const parsed = raw ? Number.parseInt(raw, 10) : NaN
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000
	})()
	const failures: QualityGateResult[] = []
	for (let i = 0; i < uniqueGates.length; i++) {
		const gate = uniqueGates[i]
		const cwd = gate.dir ? resolve(repoRoot, gate.dir) : repoRoot
		let output = ""
		let exitCode = 0

		try {
			output = execSync(gate.command, {
				cwd,
				encoding: "utf8",
				timeout: gateTimeoutMs,
				stdio: ["pipe", "pipe", "pipe"],
			})
		} catch (err: unknown) {
			const execErr = err as {
				status?: number
				stdout?: string
				stderr?: string
				signal?: string
			}
			exitCode = execErr.status ?? 1
			const timedOut = execErr.signal === "SIGTERM"
			const rawOut = (execErr.stdout ?? "") + (execErr.stderr ?? "")
			const prefix = timedOut
				? `[timeout after ${gateTimeoutMs}ms — command killed with SIGTERM]\n`
				: ""
			output = (prefix + rawOut).slice(0, 500)
		}

		if (exitCode !== 0) {
			failures.push({
				name: gate.name || `gate-${i}`,
				command: gate.command,
				dir: gate.dir,
				exit_code: exitCode,
				output,
			})
		}
	}

	return failures
}
