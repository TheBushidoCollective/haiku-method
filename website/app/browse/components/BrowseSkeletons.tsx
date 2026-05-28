"use client"

// Path-aware loading skeletons for the browse views. The skeleton shown while a
// page loads should match the page being loaded — a deep link to a unit should
// flash a unit-shaped skeleton, not the portfolio list. `BrowseSkeleton` picks
// the right shape from the parsed location (unit > stage > intent > list).

import type { BrowseLocation } from "@/lib/browse/url"

/** Solid placeholder bar (stronger tone — titles, primary values). */
function Bar({ className }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-stone-200 dark:bg-stone-700 ${className ?? ""}`}
		/>
	)
}
/** Faint placeholder bar (secondary meta). */
function Faint({ className }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-stone-100 dark:bg-stone-800 ${className ?? ""}`}
		/>
	)
}

function Card({ children }: { children: React.ReactNode }) {
	return (
		<div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
			{children}
		</div>
	)
}

/** Portfolio list — header + a column of intent-card rows. */
export function ListSkeleton() {
	return (
		<div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
			<div className="mb-8">
				<Bar className="mb-2 h-4 w-16" />
				<Bar className="h-8 w-48" />
				<Faint className="mt-2 h-4 w-64" />
			</div>
			<div className="space-y-3">
				{[1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className="rounded-xl border border-stone-200 px-6 py-4 dark:border-stone-700"
					>
						<div className="flex items-center justify-between">
							<div className="w-full">
								<Bar className="h-5 w-48" />
								<div className="mt-2 flex gap-4">
									<Faint className="h-3 w-20" />
									<Faint className="h-3 w-16" />
									<Faint className="h-3 w-24" />
								</div>
							</div>
							<Faint className="h-8 w-12" />
						</div>
						<Faint className="mt-3 h-1.5 w-full rounded-full" />
					</div>
				))}
			</div>
		</div>
	)
}

/** Intent overview — title, meta row, a pipeline strip, and a few stage cards. */
export function IntentSkeleton() {
	return (
		<div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
			<Faint className="mb-4 h-4 w-24" />
			<div className="mb-2 flex items-center gap-3">
				<Bar className="h-8 w-72" />
				<Faint className="h-5 w-20 rounded" />
			</div>
			<div className="mb-8 flex gap-4">
				<Faint className="h-4 w-24" />
				<Faint className="h-4 w-20" />
				<Faint className="h-4 w-28" />
			</div>
			{/* pipeline strip */}
			<div className="mb-8 flex flex-wrap gap-2">
				{[1, 2, 3, 4, 5].map((i) => (
					<Faint key={i} className="h-8 w-28 rounded-lg" />
				))}
			</div>
			<div className="space-y-3">
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<Bar className="h-5 w-40" />
						<Faint className="mt-2 h-3 w-full" />
						<Faint className="mt-1 h-3 w-2/3" />
					</Card>
				))}
			</div>
		</div>
	)
}

/** Stage detail — breadcrumb, stage title, and a column of unit rows. */
export function StageSkeleton() {
	return (
		<div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
			<Faint className="mb-4 h-4 w-56" />
			<Bar className="mb-2 h-7 w-56" />
			<Faint className="mb-8 h-4 w-80" />
			<Bar className="mb-3 h-4 w-24" />
			<div className="space-y-2">
				{[1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-700"
					>
						<div className="w-full">
							<Bar className="h-4 w-56" />
							<Faint className="mt-2 h-3 w-24" />
						</div>
						<Faint className="h-5 w-16 rounded" />
					</div>
				))}
			</div>
		</div>
	)
}

/** Unit detail — breadcrumb, header, the quick-stat tile row, and sections. */
export function UnitSkeleton() {
	return (
		<div className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
			<Faint className="mb-4 h-4 w-64" />
			<div className="mb-8 flex items-center gap-3">
				<Faint className="h-7 w-16 rounded-md" />
				<Bar className="h-7 w-72" />
			</div>
			{/* quick-stat tiles */}
			<div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<Faint className="h-3 w-16" />
						<Bar className="mt-2 h-6 w-12" />
					</Card>
				))}
			</div>
			{/* sections */}
			{[1, 2].map((i) => (
				<div key={i} className="mb-8">
					<Bar className="mb-3 h-4 w-40" />
					<Card>
						<Faint className="h-3 w-full" />
						<Faint className="mt-2 h-3 w-5/6" />
						<Faint className="mt-2 h-3 w-3/4" />
					</Card>
				</div>
			))}
		</div>
	)
}

/** Pick the skeleton that matches the page being loaded. */
export function BrowseSkeleton({
	location,
}: {
	location?: BrowseLocation | null
}) {
	if (location?.unit) return <UnitSkeleton />
	if (location?.stage) return <StageSkeleton />
	if (location?.intent) return <IntentSkeleton />
	return <ListSkeleton />
}
