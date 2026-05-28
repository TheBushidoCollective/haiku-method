import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import { getAllStudios, getStudioBySlug } from "@/lib/studios"
import {
	ExpandableArtifact,
	PhaseSection,
	reviewBadge,
	titleCase,
} from "../_components/studio-ui"

interface Props {
	params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
	const studios = getAllStudios()
	return studios.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const studio = getStudioBySlug(slug)
	if (!studio) return { title: "Not Found" }
	return {
		title: `${titleCase(studio.name)} Studio - H·AI·K·U`,
		description: studio.description,
	}
}

export default async function StudioDetailPage({ params }: Props) {
	const { slug } = await params
	const studio = getStudioBySlug(slug)
	if (!studio) notFound()

	const totalHats = studio.stageDefinitions.reduce(
		(acc, s) => acc + s.hatDefinitions.length,
		0,
	)
	const totalAgents = studio.stageDefinitions.reduce(
		(acc, s) => acc + s.reviewAgentDefinitions.length,
		0,
	)

	const hasIntentClose =
		studio.intentReviewAgentDefinitions.length > 0 ||
		studio.studioFixHatDefinitions.length > 0 ||
		studio.reflectionDefinitions.length > 0

	return (
		<div className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
			{/* Breadcrumb */}
			<nav className="mb-6 text-sm text-stone-500 dark:text-stone-400">
				<Link
					href="/studios/"
					className="hover:text-stone-900 dark:hover:text-white"
				>
					Studios
				</Link>
				<span className="mx-2">/</span>
				<span className="text-stone-900 dark:text-white">
					{titleCase(studio.name)}
				</span>
			</nav>

			{/* Header */}
			<header className="mb-8">
				<div className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
					{studio.category}
				</div>
				<h1 className="mb-3 text-4xl font-bold tracking-tight">
					{titleCase(studio.name)} Studio
				</h1>
				<p className="text-lg text-stone-600 dark:text-stone-400">
					{studio.description}
				</p>
				<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
					<span>
						<strong className="text-stone-700 dark:text-stone-300">
							{studio.stages.length}
						</strong>{" "}
						stages
					</span>
					<span>
						<strong className="text-stone-700 dark:text-stone-300">
							{totalHats}
						</strong>{" "}
						hats
					</span>
					<span>
						<strong className="text-stone-700 dark:text-stone-300">
							{totalAgents}
						</strong>{" "}
						review agents
					</span>
					<span>
						Persistence:{" "}
						<strong className="text-stone-700 dark:text-stone-300">
							auto-detected
						</strong>
					</span>
				</div>
				<div className="mt-6 flex flex-wrap gap-3">
					<Link
						href={`/studios/${slug}/demo/`}
						className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
					>
						<svg
							className="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Simulate a Session
					</Link>
					<Link
						href={`/studios/${slug}/architecture/`}
						className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
					>
						<svg
							className="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 6h16M4 12h16M4 18h16"
							/>
						</svg>
						View Architecture
					</Link>
				</div>
			</header>

			{/* Studio overview — the STUDIO.md prose, surfaced near the top */}
			{studio.content && (
				<section className="mb-12 rounded-xl border border-stone-200 bg-stone-50/60 px-6 py-5 dark:border-stone-800 dark:bg-stone-900/40">
					<div className="prose prose-stone dark:prose-invert max-w-none prose-headings:scroll-mt-20">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeSlug]}
						>
							{studio.content}
						</ReactMarkdown>
					</div>
				</section>
			)}

			{/* Stage pipeline (compact strip) */}
			<section className="mb-8">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-400">
					The lifecycle an intent runs
				</h2>
				<div className="flex flex-wrap items-center gap-1">
					{studio.stageDefinitions.map((stage, i) => (
						<div key={stage.name} className="flex items-center">
							<Link
								href={`/studios/${slug}/stages/${stage.name}/`}
								className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-teal-300 hover:text-teal-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-teal-700 dark:hover:text-teal-400"
							>
								{titleCase(stage.name)}
							</Link>
							{i < studio.stageDefinitions.length - 1 && (
								<svg
									className="mx-0.5 h-4 w-4 flex-shrink-0 text-stone-300 dark:text-stone-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 5l7 7-7 7"
									/>
								</svg>
							)}
						</div>
					))}
				</div>
			</section>

			{/* Stage list — overview only, each links to its detail page */}
			<section className="mb-14 space-y-3">
				{studio.stageDefinitions.map((stage, i) => {
					const badge = reviewBadge[stage.review] || reviewBadge.ask
					const counts: string[] = []
					if (stage.hatDefinitions.length)
						counts.push(`${stage.hatDefinitions.length} hats`)
					if (stage.reviewAgentDefinitions.length)
						counts.push(`${stage.reviewAgentDefinitions.length} review agents`)
					if (stage.fixHats.length)
						counts.push(`${stage.fixHats.length}-step fix loop`)
					if (stage.discoveryDefinitions.length)
						counts.push(`${stage.discoveryDefinitions.length} discovery`)
					if (stage.outputDefinitions.length)
						counts.push(`${stage.outputDefinitions.length} outputs`)
					return (
						<Link
							key={stage.name}
							href={`/studios/${slug}/stages/${stage.name}/`}
							className="group flex items-start gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 transition hover:border-teal-300 hover:shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:hover:border-teal-700"
						>
							<span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
								{i + 1}
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex flex-wrap items-center gap-2">
									<span className="text-lg font-bold text-stone-900 group-hover:text-teal-600 dark:text-stone-100 dark:group-hover:text-teal-400">
										{titleCase(stage.name)}
									</span>
									<span
										className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.color}`}
									>
										{badge.label} gate
									</span>
								</span>
								{stage.description && (
									<span className="mt-1 block text-sm text-stone-600 dark:text-stone-400">
										{stage.description}
									</span>
								)}
								{counts.length > 0 && (
									<span className="mt-2 block text-xs text-stone-400 dark:text-stone-500">
										{counts.join(" · ")}
									</span>
								)}
							</span>
							<svg
								className="mt-1 h-5 w-5 flex-shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-teal-500 dark:text-stone-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</Link>
					)
				})}
			</section>

			{/* Intent-close lifecycle — fires once after the final stage gate */}
			{hasIntentClose && (
				<section className="mb-14">
					<h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-400">
						At intent close
					</h2>
					<p className="mb-6 max-w-2xl text-sm text-stone-500 dark:text-stone-400">
						After the final stage&apos;s gate passes, the engine runs one
						studio-wide pass over the whole intent — review the delivered work,
						fix anything it flags, then reflect on the cycle.
					</p>
					<div className="space-y-8">
						{studio.intentReviewAgentDefinitions.length > 0 && (
							<PhaseSection
								accent="review"
								label="Intent-completion review"
								caption="studio-wide agents audit the delivered intent"
							>
								<div className="space-y-2">
									{studio.intentReviewAgentDefinitions.map((def) => (
										<ExpandableArtifact key={def.name} def={def} />
									))}
								</div>
							</PhaseSection>
						)}
						{studio.studioFixHatDefinitions.length > 0 && (
							<PhaseSection
								accent="fix"
								label="Intent fix loop"
								caption="dispatched against intent-scope findings"
							>
								<div className="space-y-2">
									{studio.studioFixHatDefinitions.map((def) => (
										<ExpandableArtifact key={def.name} def={def} />
									))}
								</div>
							</PhaseSection>
						)}
						{studio.reflectionDefinitions.length > 0 && (
							<PhaseSection
								accent="intent"
								label="Reflection"
								caption="synthesized once the intent completes"
							>
								<div className="space-y-2">
									{studio.reflectionDefinitions.map((def) => (
										<ExpandableArtifact
											key={def.name}
											def={def}
											eyebrow="dimension"
										/>
									))}
								</div>
							</PhaseSection>
						)}
					</div>
				</section>
			)}

			{/* Navigation */}
			<footer className="mt-12 flex items-center justify-between border-t border-stone-200 pt-8 dark:border-stone-800">
				<Link
					href="/studios/"
					className="text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
				>
					&larr; All Studios
				</Link>
				<Link
					href="/docs/customization/"
					className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
				>
					Customize this studio &rarr;
				</Link>
			</footer>
		</div>
	)
}
