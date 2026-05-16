/**
 * /debug/:slug — per-intent admin panel.
 *
 * The five admin ops live here as forms with inline confirmation modals.
 * Every mutation goes through a confirm dialog showing the exact request
 * body before POST — that confirmation IS the elicitation gate.
 *
 * Read panes (intent metadata + cursor preview) refresh after every
 * successful op so the user immediately sees the new cursor head.
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { Header as HeaderLandmark, Main } from "../../a11y"

interface IntentDetail {
	slug: string
	title: string | null
	studio: string | null
	mode: string | null
	status: string | null
	archived: boolean
	created_at: string | null
	frontmatter: Record<string, unknown>
	stages_present: string[]
}

interface CursorResponse {
	ok: boolean
	position?: unknown
	error?: string
}

type OpName =
	| "force_stage_complete"
	| "set_intent_field"
	| "reset_drift"
	| "mutate_feedback"
	| "set_unit_iterations"

interface PendingOp {
	op: OpName
	body: Record<string, unknown>
	summary: string
}

function DebugAdminPanel(): React.ReactElement {
	const { slug } = Route.useParams()
	const [detail, setDetail] = useState<IntentDetail | null>(null)
	const [cursor, setCursor] = useState<CursorResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState<PendingOp | null>(null)
	const [lastResult, setLastResult] = useState<{
		op: string
		response: unknown
	} | null>(null)
	const [refreshTick, setRefreshTick] = useState(0)

	useEffect(() => {
		let cancelled = false
		setError(null)
		// Reading refreshTick here (even just into a void-discarded local)
		// makes biome happy that it's a real dependency. Functionally it
		// IS the trigger — incrementing it after every successful op is how
		// the read panes refresh.
		void refreshTick
		Promise.all([
			fetch(`/api/debug/intents/${encodeURIComponent(slug)}`).then((r) =>
				r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
			),
			fetch(`/api/debug/intents/${encodeURIComponent(slug)}/cursor`).then(
				async (r) => {
					if (r.ok) return r.json() as Promise<CursorResponse>
					try {
						return await r.json()
					} catch {
						return { ok: false, error: `HTTP ${r.status}` }
					}
				},
			),
		])
			.then(([d, c]) => {
				if (cancelled) return
				setDetail(d as IntentDetail)
				setCursor(c as CursorResponse)
			})
			.catch((err) => {
				if (cancelled) return
				setError(err instanceof Error ? err.message : String(err))
			})
		return () => {
			cancelled = true
		}
	}, [slug, refreshTick])

	const runOp = useCallback(async () => {
		if (!pending) return
		setError(null)
		try {
			const res = await fetch(
				`/api/debug/intents/${encodeURIComponent(slug)}/ops/${pending.op}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(pending.body),
				},
			)
			const json = await res.json()
			setLastResult({ op: pending.op, response: json })
			setPending(null)
			setRefreshTick((t) => t + 1)
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		}
	}, [pending, slug])

	return (
		<>
			<HeaderLandmark className="border-b border-stone-200 bg-white px-6 py-4 dark:border-stone-800 dark:bg-stone-950">
				<div className="flex items-center justify-between">
					<div>
						<Link
							to="/debug"
							className="text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
						>
							← all intents
						</Link>
						<h1 className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-100">
							Debug: {slug}
						</h1>
					</div>
					<button
						type="button"
						onClick={() => setRefreshTick((t) => t + 1)}
						className="rounded border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
					>
						Refresh
					</button>
				</div>
			</HeaderLandmark>
			<Main className="px-6 py-6">
				{error && (
					<div
						className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
						role="alert"
					>
						Error: {error}
					</div>
				)}
				{lastResult && (
					<div className="mb-4 rounded-md border border-teal-300 bg-teal-50 p-4 text-sm dark:border-teal-800 dark:bg-teal-950">
						<div className="font-mono text-xs text-teal-900 dark:text-teal-200">
							{lastResult.op}
						</div>
						<pre className="mt-2 overflow-x-auto text-xs text-teal-900 dark:text-teal-200">
							{JSON.stringify(lastResult.response, null, 2)}
						</pre>
					</div>
				)}

				<div className="grid gap-6 lg:grid-cols-2">
					<section className="rounded-md border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
							Intent
						</h2>
						{detail ? (
							<dl className="mt-3 space-y-1 text-sm">
								<Row label="title" value={detail.title} />
								<Row label="studio" value={detail.studio} />
								<Row label="mode" value={detail.mode} />
								<Row label="status" value={detail.status} />
								<Row
									label="archived"
									value={detail.archived ? "true" : "false"}
								/>
								<Row label="stages" value={detail.stages_present.join(", ")} />
							</dl>
						) : (
							<p className="mt-2 text-sm text-stone-500">Loading…</p>
						)}
					</section>

					<section className="rounded-md border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
							Cursor preview (next tick)
						</h2>
						<pre className="mt-3 overflow-x-auto text-xs text-stone-700 dark:text-stone-300">
							{cursor ? JSON.stringify(cursor, null, 2) : "Loading…"}
						</pre>
					</section>
				</div>

				<div className="mt-6 grid gap-4 lg:grid-cols-2">
					<ForceStageCompleteForm
						stages={detail?.stages_present ?? []}
						onPrepare={setPending}
					/>
					<SetIntentFieldForm onPrepare={setPending} />
					<ResetDriftForm onPrepare={setPending} />
					<MutateFeedbackForm
						stages={detail?.stages_present ?? []}
						onPrepare={setPending}
					/>
					<SetUnitIterationsForm
						stages={detail?.stages_present ?? []}
						onPrepare={setPending}
					/>
				</div>
			</Main>

			{pending && (
				<ConfirmModal
					op={pending}
					onCancel={() => setPending(null)}
					onConfirm={runOp}
				/>
			)}
		</>
	)
}

function Row({
	label,
	value,
}: {
	label: string
	value: string | null | undefined
}) {
	return (
		<div className="flex">
			<dt className="w-28 font-mono text-xs text-stone-500 dark:text-stone-400">
				{label}
			</dt>
			<dd className="flex-1 text-stone-900 dark:text-stone-100">
				{value || "—"}
			</dd>
		</div>
	)
}

function ForceStageCompleteForm({
	stages,
	onPrepare,
}: {
	stages: string[]
	onPrepare: (op: PendingOp) => void
}) {
	const [stage, setStage] = useState("")
	const [closeFb, setCloseFb] = useState(false)
	useEffect(() => {
		if (!stage && stages.length > 0) setStage(stages[0])
	}, [stage, stages])
	return (
		<AdminCard
			title="Force stage complete"
			description="Sign reviews + approvals + intent_quality_gates for every unit in stages up to and including the target. Refuses units that haven't reached terminal advance. Optionally also closes every open feedback on those stages (open FBs continue blocking the cursor even after every approval is signed)."
		>
			<label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
				Target stage
				<select
					value={stage}
					onChange={(e) => setStage(e.target.value)}
					className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
				>
					<option value="">— pick stage —</option>
					{stages.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</label>
			<label className="mt-2 flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
				<input
					type="checkbox"
					checked={closeFb}
					onChange={(e) => setCloseFb(e.target.checked)}
					className="rounded border-stone-300 dark:border-stone-700"
				/>
				Also close every open feedback on these stages (stamps
				<span className="font-mono">closed_at</span> +
				<span className="font-mono">closed_by: "force_complete"</span>)
			</label>
			<button
				type="button"
				disabled={!stage}
				onClick={() =>
					onPrepare({
						op: "force_stage_complete",
						body: { stage, close_open_feedback: closeFb },
						summary: `Force stages 0..${stage} complete (sign all reviews/approvals/QGs)${closeFb ? " AND close every open feedback on those stages" : ""}.`,
					})
				}
				className="mt-3 rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Prepare op
			</button>
		</AdminCard>
	)
}

function SetIntentFieldForm({
	onPrepare,
}: {
	onPrepare: (op: PendingOp) => void
}) {
	// Multi-row form so the user can stage several FM edits and confirm
	// them all in one picker round-trip. Single row → single-mutate path;
	// multiple rows → batch path.
	const [rows, setRows] = useState<Array<{ field: string; value: string }>>([
		{ field: "mode", value: "" },
	])
	const update = (i: number, patch: { field?: string; value?: string }) => {
		setRows((prev) =>
			prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
		)
	}
	const filledRows = rows.filter((r) => r.field.trim())
	return (
		<AdminCard
			title="Set intent fields"
			description="Bypass FSM-protected intent.md frontmatter. Add more rows to set multiple keys in a single confirm. Each value is JSON-parsed if it starts with [, {, true, false, null, or a digit; otherwise treated as a string."
		>
			{rows.map((row, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: row order is the identity here — entries are positional, not keyed by field name.
					key={i}
					className="mt-2 grid grid-cols-2 gap-2"
				>
					<input
						value={row.field}
						onChange={(e) => update(i, { field: e.target.value })}
						placeholder="field"
						className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm font-mono dark:border-stone-700 dark:bg-stone-900"
					/>
					<input
						value={row.value}
						onChange={(e) => update(i, { value: e.target.value })}
						placeholder="value"
						className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm font-mono dark:border-stone-700 dark:bg-stone-900"
					/>
				</div>
			))}
			<div className="mt-2 flex items-center gap-2">
				<button
					type="button"
					onClick={() => setRows((prev) => [...prev, { field: "", value: "" }])}
					className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
				>
					+ Add row
				</button>
				{rows.length > 1 && (
					<button
						type="button"
						onClick={() => setRows((prev) => prev.slice(0, -1))}
						className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
					>
						− Remove last
					</button>
				)}
			</div>
			<button
				type="button"
				disabled={filledRows.length === 0}
				onClick={() => {
					if (filledRows.length === 1) {
						const r = filledRows[0]
						const parsed = parseLooseJsonValue(r.value)
						onPrepare({
							op: "set_intent_field",
							body: { field: r.field, value: parsed },
							summary: `Set intent.md.${r.field} = ${JSON.stringify(parsed)}`,
						})
					} else {
						const fields: Record<string, unknown> = {}
						for (const r of filledRows) {
							fields[r.field] = parseLooseJsonValue(r.value)
						}
						onPrepare({
							op: "set_intent_field",
							body: { fields },
							summary: `BATCH: set ${filledRows.length} intent.md fields in one call: ${JSON.stringify(fields)}`,
						})
					}
				}}
				className="mt-3 rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Prepare op
			</button>
		</AdminCard>
	)
}

function ResetDriftForm({ onPrepare }: { onPrepare: (op: PendingOp) => void }) {
	return (
		<AdminCard
			title="Reset drift"
			description="Re-stamp every witnessed slot (reviews + approvals on every unit) with the current on-disk SHA. Drift sweep stops finding mismatches."
		>
			<button
				type="button"
				onClick={() =>
					onPrepare({
						op: "reset_drift",
						body: {},
						summary:
							"Re-stamp every witnessed reviews/approvals slot with current on-disk SHA.",
					})
				}
				className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
			>
				Prepare op
			</button>
		</AdminCard>
	)
}

function MutateFeedbackForm({
	stages,
	onPrepare,
}: {
	stages: string[]
	onPrepare: (op: PendingOp) => void
}) {
	const [stage, setStage] = useState("")
	// One textarea for IDs — one per line. A single ID means single-mutate;
	// multiple lines fan out to the batch path so the picker confirms once
	// for the whole set.
	const [feedbackIds, setFeedbackIds] = useState("")
	const [patchJson, setPatchJson] = useState(
		'{\n  "closed_at": null,\n  "closed_by": "force_complete"\n}',
	)
	const [patchError, setPatchError] = useState<string | null>(null)
	return (
		<AdminCard
			title="Mutate feedback"
			description="Apply a JSON FM patch to one or more feedback records. No lifecycle guards. Stage blank means intent-scope feedback. Enter one FB ID per line — multiple lines batch into a single confirmation."
		>
			<label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
				Stage (blank = intent scope)
				<select
					value={stage}
					onChange={(e) => setStage(e.target.value)}
					className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
				>
					<option value="">(intent scope)</option>
					{stages.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</label>
			<label className="mt-2 block text-xs font-medium text-stone-600 dark:text-stone-400">
				Feedback IDs (one per line for batch)
				<textarea
					value={feedbackIds}
					onChange={(e) => setFeedbackIds(e.target.value)}
					placeholder={"FB-037\nFB-041\nFB-052"}
					rows={3}
					className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm font-mono dark:border-stone-700 dark:bg-stone-900"
				/>
			</label>
			<label className="mt-2 block text-xs font-medium text-stone-600 dark:text-stone-400">
				Patch (JSON object)
				<textarea
					value={patchJson}
					onChange={(e) => {
						setPatchJson(e.target.value)
						setPatchError(null)
					}}
					rows={5}
					className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs font-mono dark:border-stone-700 dark:bg-stone-900"
				/>
			</label>
			{patchError && (
				<p className="mt-1 text-xs text-red-700 dark:text-red-400">
					{patchError}
				</p>
			)}
			<button
				type="button"
				disabled={!feedbackIds.trim()}
				onClick={() => {
					let parsed: Record<string, unknown>
					try {
						parsed = JSON.parse(patchJson)
						if (typeof parsed !== "object" || parsed === null) {
							throw new Error("patch must be a JSON object")
						}
					} catch (err) {
						setPatchError(
							err instanceof Error
								? err.message
								: "patch must be a JSON object",
						)
						return
					}
					const ids = feedbackIds
						.split(/\r?\n/)
						.map((s) => s.trim())
						.filter(Boolean)
					if (ids.length === 0) return
					if (ids.length === 1) {
						onPrepare({
							op: "mutate_feedback",
							body: {
								stage: stage || undefined,
								feedback_id: ids[0],
								patch: parsed,
							},
							summary: `Apply FM patch to ${ids[0]} (${stage || "intent scope"}): ${JSON.stringify(parsed)}`,
						})
					} else {
						onPrepare({
							op: "mutate_feedback",
							body: {
								stage: stage || undefined,
								feedback_ids: ids,
								patch: parsed,
							},
							summary: `BATCH: apply FM patch to ${ids.length} feedback records (${ids.join(", ")}) on ${stage || "intent scope"}: ${JSON.stringify(parsed)}`,
						})
					}
				}}
				className="mt-3 rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Prepare op
			</button>
		</AdminCard>
	)
}

function SetUnitIterationsForm({
	stages,
	onPrepare,
}: {
	stages: string[]
	onPrepare: (op: PendingOp) => void
}) {
	const [stage, setStage] = useState("")
	const [unit, setUnit] = useState("")
	const [useAuto, setUseAuto] = useState(true)
	const [iterationsJson, setIterationsJson] = useState(
		'[\n  { "hat": "planner", "result": "advance" },\n  { "hat": "implementer", "result": "advance" },\n  { "hat": "verifier", "result": "advance" }\n]',
	)
	const [parseError, setParseError] = useState<string | null>(null)
	useEffect(() => {
		if (!stage && stages.length > 0) setStage(stages[0])
	}, [stage, stages])
	return (
		<AdminCard
			title="Set unit iterations"
			description="Hand-write the iterations[] array on a unit's frontmatter — the FSM field agents normally cannot touch. Use to mark a legacy/partial unit as 'moved through every hat' so force_stage_complete will sign it. Auto mode synthesizes one advance entry per hat in the stage's hats sequence."
		>
			<label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
				Stage
				<select
					value={stage}
					onChange={(e) => setStage(e.target.value)}
					className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
				>
					<option value="">— pick stage —</option>
					{stages.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</label>
			<label className="mt-2 block text-xs font-medium text-stone-600 dark:text-stone-400">
				Unit (slug, filename stem, or "unit-NN")
				<input
					value={unit}
					onChange={(e) => setUnit(e.target.value)}
					placeholder="unit-03-my-thing"
					className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm font-mono dark:border-stone-700 dark:bg-stone-900"
				/>
			</label>
			<label className="mt-2 flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
				<input
					type="checkbox"
					checked={useAuto}
					onChange={(e) => setUseAuto(e.target.checked)}
					className="rounded border-stone-300 dark:border-stone-700"
				/>
				Auto-synthesize one "advance" entry per hat in the stage's hats:
				sequence
			</label>
			{!useAuto && (
				<label className="mt-2 block text-xs font-medium text-stone-600 dark:text-stone-400">
					Explicit iterations (JSON array)
					<textarea
						value={iterationsJson}
						onChange={(e) => {
							setIterationsJson(e.target.value)
							setParseError(null)
						}}
						rows={6}
						className="mt-1 block w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs font-mono dark:border-stone-700 dark:bg-stone-900"
					/>
				</label>
			)}
			{parseError && (
				<p className="mt-1 text-xs text-red-700 dark:text-red-400">
					{parseError}
				</p>
			)}
			<button
				type="button"
				disabled={!stage || !unit}
				onClick={() => {
					if (useAuto) {
						onPrepare({
							op: "set_unit_iterations",
							body: { stage, unit },
							summary: `Synthesize iterations[] on ${stage}/${unit} — one 'advance' per hat in the stage's hats sequence.`,
						})
						return
					}
					let parsed: unknown
					try {
						parsed = JSON.parse(iterationsJson)
						if (!Array.isArray(parsed)) {
							throw new Error("must be a JSON array")
						}
					} catch (err) {
						setParseError(
							err instanceof Error ? err.message : "must be a JSON array",
						)
						return
					}
					onPrepare({
						op: "set_unit_iterations",
						body: { stage, unit, iterations: parsed },
						summary: `Hand-write iterations[] on ${stage}/${unit} (${(parsed as unknown[]).length} entries): ${JSON.stringify(parsed)}`,
					})
				}}
				className="mt-3 rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Prepare op
			</button>
		</AdminCard>
	)
}

function AdminCard({
	title,
	description,
	children,
}: {
	title: string
	description: string
	children: React.ReactNode
}) {
	return (
		<section className="rounded-md border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
			<h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
				{title}
			</h3>
			<p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
				{description}
			</p>
			<div className="mt-3">{children}</div>
		</section>
	)
}

function ConfirmModal({
	op,
	onCancel,
	onConfirm,
}: {
	op: PendingOp
	onCancel: () => void
	onConfirm: () => void
}) {
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={`Confirm ${op.op}`}
		>
			<div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-stone-900">
				<h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
					Confirm: {op.op}
				</h3>
				<p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
					{op.summary}
				</p>
				<details className="mt-3">
					<summary className="cursor-pointer text-xs text-stone-500 dark:text-stone-400">
						Show raw body
					</summary>
					<pre className="mt-2 overflow-x-auto rounded bg-stone-100 p-2 text-xs dark:bg-stone-800">
						{JSON.stringify(op.body, null, 2)}
					</pre>
				</details>
				<p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
					This is an ADMIN op that BYPASSES the normal workflow engine. State
					mutates immediately on confirm.
				</p>
				<div className="mt-4 flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className="rounded border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
					>
						Yes, run {op.op}
					</button>
				</div>
			</div>
		</div>
	)
}

function parseLooseJsonValue(raw: string): unknown {
	const trimmed = raw.trim()
	if (trimmed === "") return ""
	if (
		trimmed === "true" ||
		trimmed === "false" ||
		trimmed === "null" ||
		/^[\d[{"-]/.test(trimmed)
	) {
		try {
			return JSON.parse(trimmed)
		} catch {
			return raw
		}
	}
	return raw
}

export const Route = createFileRoute("/debug/$slug")({
	component: DebugAdminPanel,
})
