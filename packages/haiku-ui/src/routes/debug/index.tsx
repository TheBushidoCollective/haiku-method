/**
 * /debug — admin index. Lists every intent on disk so the user can pick
 * one to surgically edit. Pairs with the `haiku_debug` MCP tool: the tool
 * is the agent-driven path (with picker confirmation), this is the
 * user-driven path (where the SPA UI itself is the elicitation gate).
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Header as HeaderLandmark, Main } from "../../a11y"

interface IntentSummary {
	slug: string
	title: string | null
	studio: string | null
	mode: string | null
	status: string | null
	archived: boolean
	created_at: string | null
}

function DebugIndex(): React.ReactElement {
	const [intents, setIntents] = useState<IntentSummary[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		fetch("/api/debug/intents")
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`)
				return r.json() as Promise<{ intents: IntentSummary[] }>
			})
			.then((data) => {
				if (cancelled) return
				setIntents(data.intents)
			})
			.catch((err) => {
				if (cancelled) return
				setError(err instanceof Error ? err.message : String(err))
			})
		return () => {
			cancelled = true
		}
	}, [])

	return (
		<>
			<HeaderLandmark className="border-b border-stone-200 bg-white px-6 py-4 dark:border-stone-800 dark:bg-stone-950">
				<h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
					H·AI·K·U Debug — Intent Index
				</h1>
				<p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
					Every mutation on the per-intent panel requires explicit confirmation.
					The SPA confirmation modal IS the elicitation gate.
				</p>
			</HeaderLandmark>
			<Main className="px-6 py-6">
				{error ? (
					<div
						className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
						role="alert"
					>
						Failed to load intents: {error}
					</div>
				) : intents === null ? (
					<p className="text-sm text-stone-600 dark:text-stone-400">Loading…</p>
				) : intents.length === 0 ? (
					<p className="text-sm text-stone-600 dark:text-stone-400">
						No intents found. Nothing to debug.
					</p>
				) : (
					<table className="w-full text-sm">
						<thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
							<tr>
								<th className="py-2 pr-4">Slug</th>
								<th className="py-2 pr-4">Title</th>
								<th className="py-2 pr-4">Studio</th>
								<th className="py-2 pr-4">Mode</th>
								<th className="py-2 pr-4">Status</th>
								<th className="py-2 pr-4" />
							</tr>
						</thead>
						<tbody>
							{intents.map((i) => (
								<tr
									key={i.slug}
									className="border-b border-stone-100 dark:border-stone-900"
								>
									<td className="py-2 pr-4 font-mono text-xs text-stone-700 dark:text-stone-300">
										{i.slug}
									</td>
									<td className="py-2 pr-4">{i.title ?? "—"}</td>
									<td className="py-2 pr-4">{i.studio ?? "—"}</td>
									<td className="py-2 pr-4">{i.mode ?? "—"}</td>
									<td className="py-2 pr-4">
										{i.archived ? "archived" : (i.status ?? "active")}
									</td>
									<td className="py-2 pr-4 text-right">
										<Link
											to="/debug/$slug"
											params={{ slug: i.slug }}
											className="text-teal-700 underline hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
										>
											admin →
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Main>
		</>
	)
}

export const Route = createFileRoute("/debug/")({
	component: DebugIndex,
})
