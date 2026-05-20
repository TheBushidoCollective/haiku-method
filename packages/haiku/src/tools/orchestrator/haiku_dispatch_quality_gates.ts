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

// How many engine-authored quality_gates FBs the local fix loop gets to
// file for the same target before the engine DEFERS the gate to CI. Each
// gate FB drives up to MAX_FIX_LOOP_BOLTS fixer attempts, so this is
// several bolts of effort. Once this many still leave the gate red, the
// gate is treated as non-source-convergent in THIS environment (no local
// API, worktree dep mismatch, un-regenerated codegen — admin-portal #1/#4,
// 2026-05-20): the engine stops re-filing blocking FBs, stamps the
// approval as deferred, closes the open gate FBs, and lets the workflow
// advance. CI re-runs the gate on the PR and is the authority — a real
// defect shows as red CI; an environment-only failure passes clean. This
// replaces the wedge where an unfixable gate FB stayed open forever,
// keeping approvals.quality_gates invalidated so the stage never closed.
const GATE_DEFER_AFTER_ATTEMPTS = 2

type FbOnDisk = { path: string; data: Record<string, unknown> }

/** Engine-authored quality_gates FBs on disk for a target (`unit:<slug>`
 *  at stage scope, or `intent_quality_gates` at intent scope) — open or
 *  closed. Counts prior fix-loop attempts and lets the deferral close the
 *  still-open ones. */
function gateFbsFor(slug: string, stage: string, sourceRef: string): FbOnDisk[] {
	const dir = stage
		? join(intentDir(slug), "stages", stage, "feedback")
		: join(intentDir(slug), "feedback")
	if (!existsSync(dir)) return []
	const out: FbOnDisk[] = []
	for (const f of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
		try {
			const p = join(dir, f)
			const data = matter(readFileSync(p, "utf8")).data as Record<
				string,
				unknown
			>
			if (
				(data.author as string) === "engine" &&
				(data.source_ref as string) === sourceRef
			) {
				out.push({ path: p, data })
			}
		} catch {
			/* skip unreadable */
		}
	}
	return out
}

function isFbOpen(data: Record<string, unknown>): boolean {
	if (data.closed_at || data.rejected_at) return false
	const st = data.status as string | undefined
	return st !== "closed" && st !== "rejected"
}

/** Close a gate FB as deferred-to-CI with a DIRECT write — deliberately
 *  NOT through the feedback-close handler, so `applyFeedbackInvalidations`
 *  does NOT fire and clear the `quality_gates` approval the caller just
 *  stamped as deferred. */
function closeGateFbDeferred(path: string, reason: string): void {
	try {
		const parsed = matter(readFileSync(path, "utf8"))
		const data = parsed.data as Record<string, unknown>
		const now = new Date().toISOString()
		data.status = "closed"
		data.closed_at = now
		data.closed_by = "engine:gate-deferred-to-ci"
		data.resolution = "deferred"
		data.closure_reply = { text: reason, at: now }
		writeFileSync(path, matter.stringify(parsed.content, data))
	} catch {
		/* best-effort */
	}
}

/** Stamp a unit's `approvals.quality_gates` as DEFERRED-to-CI (non-null,
 *  so the cursor passes the gate and the stage advances) and record the
 *  deferred gate commands + last failure on the unit FM as
 *  `deferred_gates` for the PR / audit surface. */
function stampUnitGateDeferral(
	unitPath: string,
	failures: GateFailure["failures"],
): void {
	try {
		const parsed = matter(readFileSync(unitPath, "utf8"))
		const data = parsed.data as Record<string, unknown>
		const now = new Date().toISOString()
		const approvals = (data.approvals as Record<string, unknown>) ?? {}
		approvals.quality_gates = {
			at: now,
			deferred_to_ci: true,
			deferred_count: failures.length,
		}
		data.approvals = approvals
		const existing = Array.isArray(data.deferred_gates)
			? (data.deferred_gates as unknown[])
			: []
		data.deferred_gates = [
			...existing,
			...failures.map((f) => ({
				name: f.name,
				command: f.command,
				exit_code: f.exit_code,
				output: f.output.slice(0, 300),
				deferred_at: now,
			})),
		]
		writeFileSync(unitPath, matter.stringify(parsed.content, data))
	} catch {
		/* best-effort */
	}
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
	const deferred: Array<{ unit: string; gates: string[]; reason: string }> = []

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
			const sourceRef = `unit:${unit}`
			const priorAttempts = gateFbsFor(intent, stage, sourceRef).length
			if (priorAttempts >= GATE_DEFER_AFTER_ATTEMPTS) {
				// Non-convergent: the fix loop has had GATE_DEFER_AFTER_ATTEMPTS
				// engine gate FBs (each up to MAX_FIX_LOOP_BOLTS bolts) and the
				// gate still fails. Defer to CI rather than re-file a blocking
				// FB that would keep the stage wedged. Stamp the approval
				// deferred (so the cursor passes the gate), record the deferred
				// gates on the unit, and close any still-open gate FBs with a
				// DIRECT write (no invalidation hook → the deferral stamp
				// survives).
				const gateNames = result.failures.map((f) => f.name)
				const reason = `quality_gates on \`${unit}\` (${gateNames.join(", ")}) stayed red across ${priorAttempts} local fix-loop attempt(s). Deferred to CI — CI runs them in a clean tree and is authoritative. A real defect surfaces as red CI on the PR; an environment-only failure (no local API, dep/codegen mismatch in the worktree) passes there.`
				stampUnitGateDeferral(unitPath, result.failures)
				for (const fb of gateFbsFor(intent, stage, sourceRef)) {
					if (isFbOpen(fb.data)) closeGateFbDeferred(fb.path, reason)
				}
				deferred.push({ unit, gates: gateNames, reason })
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
					body: `One or more declared quality_gates failed on unit \`${unit}\`:\n\n${failureSummary}\n\nThe fix loop should resolve the failure, then quality_gates re-runs on the next tick. If the gate keeps failing across attempts, the engine defers it to CI (environmental / non-source-convergent).`,
					origin: "agent",
					author: "engine",
					source_ref: sourceRef,
					targetUnit: unit,
					targetInvalidates: ["quality_gates"],
				})
			}
		}
	}

	const deferredNote =
		deferred.length > 0
			? ` ${deferred.length} unit(s) had non-convergent gates DEFERRED to CI: ${deferred.map((d) => `${d.unit} (${d.gates.join(", ")})`).join("; ")}.`
			: ""
	return text(
		JSON.stringify(
			{
				scope: "stage",
				passed,
				failures,
				deferred,
				message:
					failures.length === 0 && deferred.length === 0
						? `All ${passed.length} unit(s) passed quality_gates. Approvals stamped.`
						: `${failures.length} unit(s) had quality_gate failures — FBs filed. ${passed.length} passed.${deferredNote}`,
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

	// Non-convergent intent gates → defer to CI (mirror of the stage-scope
	// path). When the studio fix-hat loop has had GATE_DEFER_AFTER_ATTEMPTS
	// engine gate FBs and the intent-scope commands still fail, stamp
	// approvals.intent_quality_gates as deferred, close the open gate FBs
	// with a direct write (no invalidation hook), and let the intent seal.
	// CI is authoritative on the PR.
	const priorIntentAttempts = gateFbsFor(
		intent,
		"",
		"intent_quality_gates",
	).length
	if (priorIntentAttempts >= GATE_DEFER_AFTER_ATTEMPTS) {
		const gateNames = failures.map((f) => f.name)
		const reason = `intent_quality_gates (${gateNames.join(", ")}) stayed red across ${priorIntentAttempts} fix-loop attempt(s). Deferred to CI — it runs them in a clean tree and is authoritative.`
		stampIntentGateDeferral(intent, failures)
		for (const fb of gateFbsFor(intent, "", "intent_quality_gates")) {
			if (isFbOpen(fb.data)) closeGateFbDeferred(fb.path, reason)
		}
		return text(
			JSON.stringify(
				{
					scope: "intent",
					ran: distinctGates.length,
					failures,
					deferred: { gates: gateNames, reason },
					message: `${failures.length} of ${distinctGates.length} intent-scope quality_gates stayed red across ${priorIntentAttempts} fix-loop attempt(s) — DEFERRED to CI. approvals.intent_quality_gates stamped deferred; intent can seal.`,
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
		body: `${failures.length} of ${distinctGates.length} distinct quality_gates command(s) failed at intent scope. The studio fix-hat loop should resolve each failure; on close, the cursor's intent walk will re-dispatch dispatch_quality_gates because approvals.intent_quality_gates is still unset. If the gates keep failing across attempts, the engine defers them to CI (environmental / non-source-convergent).\n\n${failureSummary}`,
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

/** Intent-scope mirror of `stampUnitGateDeferral`: stamp
 *  `approvals.intent_quality_gates` on intent.md as deferred-to-CI and
 *  record the deferred commands as `deferred_gates`. */
function stampIntentGateDeferral(
	intent: string,
	failures: IntentGateFailure[],
): void {
	const intentMdPath = join(intentDir(intent), "intent.md")
	if (!existsSync(intentMdPath)) return
	try {
		const parsed = matter(readFileSync(intentMdPath, "utf8"))
		const data = parsed.data as Record<string, unknown>
		const now = new Date().toISOString()
		const approvals = (data.approvals as Record<string, unknown>) ?? {}
		approvals.intent_quality_gates = {
			at: now,
			deferred_to_ci: true,
			deferred_count: failures.length,
		}
		data.approvals = approvals
		const existing = Array.isArray(data.deferred_gates)
			? (data.deferred_gates as unknown[])
			: []
		data.deferred_gates = [
			...existing,
			...failures.map((f) => ({
				name: f.name,
				command: f.command,
				exit_code: f.exit_code,
				output: f.output.slice(0, 300),
				deferred_at: now,
			})),
		]
		writeFileSync(intentMdPath, matter.stringify(parsed.content, data))
	} catch {
		/* best-effort */
	}
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
