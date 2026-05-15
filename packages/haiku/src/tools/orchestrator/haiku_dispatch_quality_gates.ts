// tools/orchestrator/haiku_dispatch_quality_gates.ts — Run unit
// quality_gates as the v4 `approvals.quality_gates` actor at two
// scopes (per GOALS § "Quality gates are one handler at three
// scopes"; the third — per-unit, in-hat — runs inline at terminal-hat
// advance and doesn't go through this tool).
//
// **Stage scope.** Cursor returns `dispatch_quality_gates { stage,
// units }` when the post-execute approval track reaches the
// quality_gates role. Run each unit's `quality_gates: [{name,
// command, dir?}]` synchronously. On all-pass for a unit, stamp
// `approvals.quality_gates` on the unit FM. On any failure, file an
// FB targeting the unit (origin: `agent`, targets.invalidates:
// ["quality_gates"]) so the cursor reroutes through the fix loop.
//
// **Intent scope.** Cursor returns `dispatch_quality_gates { stage:
// "", units: [], scope: "intent" }` after every intent_review role
// is signed and before seal_intent. Walk every stage's units, collect
// the union of their `quality_gates[]`, dedupe by command, run each
// distinct command **once** at intent-root cwd. On all-pass, stamp
// `approvals.intent_quality_gates` on intent.md FM. On any failure,
// file an intent-scope FB with `targets.invalidates:
// ["intent_quality_gates"]`; the studio fix-hat loop addresses it
// and the cursor re-dispatches on the next tick.
//
// This replaces the v3 inline last-hat quality_gates check that lived
// inside `advance_hat`. Moving it into an explicit cursor actor:
//   - Surfaces failures as FBs (not opaque errors thrown from
//     advance_hat)
//   - Decouples merge from gate-running
//   - Makes mode-shaping uniform: autopilot still runs gates;
//     continuous + discrete also run them as part of the role list

import { execSync } from "node:child_process"
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { buildApprovalRecord } from "../../orchestrator/workflow/sign-slot.js"
import {
	intentDir,
	runInlineQualityGates,
	writeFeedbackFile,
} from "../../state-tools.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

type GateFailure = {
	unit: string
	failures: Array<{
		name: string
		command: string
		exit_code: number
		output: string
	}>
}

interface IntentGate {
	name: string
	command: string
	dir?: string
	contributors: string[]
}

interface IntentGateFailure {
	name: string
	command: string
	exit_code: number
	output: string
	contributors: string[]
}

export default defineTool({
	name: "haiku_dispatch_quality_gates",
	description:
		"Run the declared `quality_gates` at stage scope (per-unit, with fix-loop on failure) or at intent scope (union of all units' gates, deduped by command, stamped on intent.md). Engine-callable from the cursor's dispatch_quality_gates action.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent: { type: "string" },
			stage: { type: "string" },
			units: { type: "array", items: { type: "string" } },
			scope: { type: "string", enum: ["intent", "stage"] },
		},
		required: ["intent"],
	},
	async handle(args) {
		const intent = args.intent as string
		const stage = (args.stage as string) || ""
		const units = (args.units as string[]) || []
		const scope =
			(args.scope as string | undefined) ?? (stage === "" ? "intent" : "stage")

		if (scope === "intent") {
			return runIntentScope(intent)
		}
		return runStageScope(intent, stage, units)
	},
})

function runStageScope(intent: string, stage: string, units: string[]) {
	const passed: string[] = []
	const failures: GateFailure[] = []

	for (const unit of units) {
		const unitPath = join(
			intentDir(intent),
			"stages",
			stage,
			"units",
			`${unit}.md`,
		)
		if (!existsSync(unitPath)) {
			failures.push({
				unit,
				failures: [
					{
						name: "unit_not_found",
						command: "",
						exit_code: 1,
						output: `Unit file not found at ${unitPath}`,
					},
				],
			})
			continue
		}
		const result = runInlineQualityGates(intent, unitPath)
		if (result === null) {
			// runQualityGates returns null on all-pass.
			stampUnitApproval(unitPath, "quality_gates")
			passed.push(unit)
		} else {
			failures.push({ unit, failures: result.failures })
			// File an FB targeting this unit, invalidating the
			// quality_gates role. The fix loop addresses the gate
			// failure; on its terminal advance, this approval
			// reopens (as null) and the cursor re-dispatches the
			// gates. Closure of the FB clears the invalidation.
			const failureSummary = result.failures
				.map((f) => `- ${f.name}: \`${f.command}\` exited ${f.exit_code}`)
				.join("\n")
			writeFeedbackFile(intent, stage, {
				title: `quality_gates failure on ${unit}`,
				body: `One or more declared quality_gates failed on unit \`${unit}\`:\n\n${failureSummary}\n\nThe fix loop should resolve the failure, then quality_gates re-runs on the next tick.`,
				origin: "agent",
				author: "engine",
				source_ref: `unit:${unit}`,
			})
		}
	}

	return text(
		JSON.stringify(
			{
				scope: "stage",
				passed,
				failures,
				message:
					failures.length === 0
						? `All ${passed.length} unit(s) passed quality_gates. Approvals stamped.`
						: `${failures.length} unit(s) had quality_gate failures — FBs filed. ${passed.length} passed.`,
			},
			null,
			2,
		),
	)
}

function runIntentScope(intent: string) {
	const intentRoot = intentDir(intent)
	const stagesRoot = join(intentRoot, "stages")
	const distinctGates = collectIntentScopeGates(stagesRoot)
	if (distinctGates.length === 0) {
		// No declared gates anywhere — stamp clean and let the cursor
		// fall through to seal.
		stampIntentApproval(intent, "intent_quality_gates")
		return text(
			JSON.stringify(
				{
					scope: "intent",
					ran: 0,
					failures: [],
					message:
						"No quality_gates declared on any unit across this intent. Approvals stamped (vacuously true).",
				},
				null,
				2,
			),
		)
	}

	const failures: IntentGateFailure[] = []
	for (const gate of distinctGates) {
		const cwd = gate.dir ? join(process.cwd(), gate.dir) : process.cwd()
		try {
			execSync(gate.command, {
				stdio: "pipe",
				cwd,
				shell: "/bin/bash",
				timeout: 300_000,
			})
		} catch (err) {
			const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer }
			failures.push({
				name: gate.name,
				command: gate.command,
				exit_code: typeof e.status === "number" ? e.status : 1,
				output: [
					e.stdout ? e.stdout.toString().trim() : "",
					e.stderr ? e.stderr.toString().trim() : "",
				]
					.filter(Boolean)
					.join("\n"),
				contributors: gate.contributors,
			})
		}
	}

	if (failures.length === 0) {
		stampIntentApproval(intent, "intent_quality_gates")
		return text(
			JSON.stringify(
				{
					scope: "intent",
					ran: distinctGates.length,
					failures: [],
					message: `All ${distinctGates.length} distinct quality_gates command(s) passed at intent scope. approvals.intent_quality_gates stamped on intent.md.`,
				},
				null,
				2,
			),
		)
	}

	// File an intent-scope FB describing the failures. targets.invalidates
	// clears the intent_quality_gates approval on close so the next tick
	// re-dispatches.
	const failureSummary = failures
		.map(
			(f) =>
				`- **${f.name}**: \`${f.command}\` exited ${f.exit_code} (declared by: ${f.contributors.join(", ")})\n  ${f.output.slice(0, 400).split("\n").join("\n  ")}`,
		)
		.join("\n\n")
	// File an intent-scope FB. We don't stamp `targets.invalidates`
	// because we never stamped `approvals.intent_quality_gates` in the
	// first place — the failure path skips the stamp, so the cursor
	// will naturally re-dispatch on the next tick after the FB closes.
	// The body describes the failure for the studio fix-hat loop.
	writeFeedbackFile(intent, "", {
		title: `intent_quality_gates: ${failures.length} failing command(s)`,
		body: `${failures.length} of ${distinctGates.length} distinct quality_gates command(s) failed at intent scope. The studio fix-hat loop should resolve each failure; on close, the cursor's intent walk will re-dispatch dispatch_quality_gates because approvals.intent_quality_gates is still unset.\n\n${failureSummary}`,
		origin: "agent",
		author: "engine",
		source_ref: "intent_quality_gates",
	})
	return text(
		JSON.stringify(
			{
				scope: "intent",
				ran: distinctGates.length,
				failures,
				message: `${failures.length} of ${distinctGates.length} distinct quality_gates command(s) failed at intent scope — intent-scope FB filed.`,
			},
			null,
			2,
		),
	)
}

/** Walk every `stages/<stage>/units/unit-*.md`, collect their
 *  `quality_gates[]`, dedupe by `command` (the canonical equality —
 *  same command at the same dir is the same gate), and return the
 *  distinct list with contributing unit slugs for the failure
 *  surface. */
function collectIntentScopeGates(stagesRoot: string): IntentGate[] {
	if (!existsSync(stagesRoot)) return []
	const gateMap = new Map<string, IntentGate>()
	const stageDirs = readdirSync(stagesRoot).filter((name) => {
		try {
			return statSync(join(stagesRoot, name)).isDirectory()
		} catch {
			return false
		}
	})
	for (const stage of stageDirs) {
		const unitsDir = join(stagesRoot, stage, "units")
		if (!existsSync(unitsDir)) continue
		const unitFiles = readdirSync(unitsDir).filter(
			(f) => f.startsWith("unit-") && f.endsWith(".md"),
		)
		for (const file of unitFiles) {
			const unitPath = join(unitsDir, file)
			let raw: string
			try {
				raw = readFileSync(unitPath, "utf8")
			} catch {
				continue
			}
			let data: Record<string, unknown>
			try {
				data = matter(raw).data as Record<string, unknown>
			} catch {
				continue
			}
			const gates = data.quality_gates
			if (!Array.isArray(gates)) continue
			for (const g of gates) {
				if (!g || typeof g !== "object") continue
				const obj = g as Record<string, unknown>
				const name = typeof obj.name === "string" ? obj.name : ""
				const command = typeof obj.command === "string" ? obj.command : ""
				if (!command) continue
				const dir =
					typeof obj.dir === "string" && obj.dir.length > 0
						? obj.dir
						: undefined
				const key = `${dir ?? ""}::${command}`
				const existing = gateMap.get(key)
				const contributorSlug = `${stage}/${file.replace(/\.md$/, "")}`
				if (existing) {
					if (!existing.contributors.includes(contributorSlug)) {
						existing.contributors.push(contributorSlug)
					}
				} else {
					gateMap.set(key, {
						name: name || `gate-${gateMap.size + 1}`,
						command,
						dir,
						contributors: [contributorSlug],
					})
				}
			}
		}
	}
	return [...gateMap.values()]
}

/** Stamp `approvals.<role>` on a unit's frontmatter with a witnesses
 *  map. Each declared output gets its sha256 captured at sign time so
 *  the drift sweep can detect later edits to those files. */
function stampUnitApproval(unitPath: string, role: string): void {
	const raw = readFileSync(unitPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	const approvals = (data.approvals as Record<string, unknown>) ?? {}
	const outputs = Array.isArray(data.outputs) ? (data.outputs as string[]) : []
	const intentDirAbs = unitPath.split("/stages/")[0]
	approvals[role] = buildApprovalRecord(intentDirAbs, outputs)
	data.approvals = approvals
	const out = matter.stringify(parsed.content, data)
	writeFileSync(unitPath, out)
}

/** Stamp an intent-scope approval on intent.md. Same shape as the
 *  unit approval but no witnesses (no per-stage outputs to hash —
 *  the intent-scope set is derived from union of unit gates and
 *  doesn't have its own artifact). */
function stampIntentApproval(intent: string, role: string): void {
	const intentMdPath = join(intentDir(intent), "intent.md")
	if (!existsSync(intentMdPath)) return
	const raw = readFileSync(intentMdPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	const approvals = (data.approvals as Record<string, unknown>) ?? {}
	approvals[role] = { at: new Date().toISOString() }
	data.approvals = approvals
	writeFileSync(intentMdPath, matter.stringify(parsed.content, data))
}
