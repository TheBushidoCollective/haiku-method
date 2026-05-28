"use client"

// Shared review/approval sign-off list — one signed/pending row per role, with
// the studio review-agent roles opening their mandate in a modal. Used by both
// the unit detail view (per-unit Reviews + Approvals) and the intent overview
// (intent-completion approvals) so the two surfaces render sign-offs the same
// way.

import { useEffect, useState } from "react"
import { formatDate } from "@/lib/browse/types"
import { BrowseMarkdown } from "./BrowseMarkdown"
import {
	loadRoleDef,
	type QualityGate,
	roleOpensModal,
	type SignOffScope,
} from "./studio-defs"

export interface SignOffEntry {
	role: string
	signed: boolean
	signedAt: string | null
}

/** Human label for a review/approval role. Raw role names read fine; we just
 *  tidy the multi-word engine roles and the special gates. */
export function roleLabel(role: string): string {
	if (role === "user") return "User"
	if (role === "quality_gates") return "Quality Gates"
	if (role === "intent_quality_gates") return "Intent Quality Gates"
	if (role === "cross-stage-consistency") return "Cross-stage Consistency"
	return role
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
}

/** A group of sign-offs (e.g. "Reviews" or "Approvals"). Each role opens a
 *  modal explaining what it does: a studio agent's mandate, an engine role's
 *  prompt body, the user-gate description, or the quality-gate command list.
 *  `stage` may be empty for intent-scope approvals — the loader then scans all
 *  stages for a stage-defined agent. `scope` picks the engine prompt variant
 *  (review = pre-execute, approve = post-execute, intent = completion). */
export function SignOffGroup({
	title,
	entries,
	studio,
	stageName,
	scope,
	qualityGates,
}: {
	title: string
	entries: SignOffEntry[]
	studio: string
	stageName: string
	scope: SignOffScope
	qualityGates?: QualityGate[]
}) {
	const [def, setDef] = useState<{
		role: string
		body: string
		path: string | null
	} | null>(null)
	const openDef = async (role: string) => {
		const loaded = await loadRoleDef({
			role,
			studio,
			stage: stageName,
			scope,
			qualityGates,
		})
		if (loaded) setDef({ role, body: loaded.body, path: loaded.path })
	}
	return (
		<div className="rounded-xl border border-stone-200 dark:border-stone-700">
			<div className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:border-stone-800">
				{title}
			</div>
			<ul className="divide-y divide-stone-100 dark:divide-stone-800">
				{entries.map(({ role, signed, signedAt }) => (
					<li
						key={role}
						className="flex items-center justify-between gap-3 px-4 py-2.5"
					>
						<div className="flex min-w-0 items-center gap-2">
							<span
								className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
									signed
										? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
										: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
								}`}
							>
								{signed ? (
									<svg
										className="h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
									>
										<title>signed</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={3}
											d="M5 13l4 4L19 7"
										/>
									</svg>
								) : (
									<span
										className="h-1.5 w-1.5 rounded-full bg-current"
										aria-hidden="true"
									/>
								)}
							</span>
							{roleOpensModal(role, studio, qualityGates) ? (
								<button
									type="button"
									onClick={() => openDef(role)}
									className="truncate text-left text-sm text-teal-700 hover:underline dark:text-teal-400"
								>
									{roleLabel(role)}
								</button>
							) : (
								<span className="truncate text-sm text-stone-700 dark:text-stone-300">
									{roleLabel(role)}
								</span>
							)}
						</div>
						<span className="flex-shrink-0 text-xs text-stone-400">
							{signedAt ? formatDate(signedAt) : signed ? "signed" : "pending"}
						</span>
					</li>
				))}
			</ul>
			{def && (
				<AgentDefModal
					title={roleLabel(def.role)}
					path={def.path}
					body={def.body}
					onClose={() => setDef(null)}
				/>
			)}
		</div>
	)
}

/** Modal that renders a review-agent mandate (markdown) in place. */
function AgentDefModal({
	title,
	path,
	body,
	onClose,
}: {
	title: string
	path: string | null
	body: string
	onClose: () => void
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		document.addEventListener("keydown", onKey)
		document.body.style.overflow = "hidden"
		return () => {
			document.removeEventListener("keydown", onKey)
			document.body.style.overflow = ""
		}
	}, [onClose])
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose()
			}}
			role="dialog"
			aria-modal="true"
			aria-label={`Agent definition: ${title}`}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: inner container stops backdrop-close propagation */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation is click-capture suppression */}
			<div
				className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between border-b border-stone-200 px-5 py-3 dark:border-stone-700">
					<div className="min-w-0">
						<h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
							{title}
						</h3>
						{path && (
							<p className="truncate font-mono text-xs text-stone-400">
								{path}
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="ml-4 rounded p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
						aria-label="Close"
					>
						&#10005;
					</button>
				</div>
				<div className="flex-1 overflow-y-auto px-5 py-4">
					<div className="prose prose-sm prose-stone max-w-none dark:prose-invert">
						<BrowseMarkdown>{body}</BrowseMarkdown>
					</div>
				</div>
			</div>
		</div>
	)
}
