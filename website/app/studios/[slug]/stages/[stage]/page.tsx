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
} from "../../../_components/studio-ui"

interface Props {
	params: Promise<{ slug: string; stage: string }>
}

export async function generateStaticParams() {
	const studios = getAllStudios()
	const params: Array<{ slug: string; stage: string }> = []
	for (const studio of studios) {
		for (const stage of studio.stageDefinitions) {
			params.push({ slug: studio.slug, stage: stage.name })
		}
	}
	return params
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug, stage: stageName } = await params
	const studio = getStudioBySlug(slug)
	const stage = studio?.stageDefinitions.find((s) => s.name === stageName)
	if (!(studio && stage)) return { title: "Not Found" }
	return {
		title: `${titleCase(stage.name)} - ${titleCase(studio.name)} Studio - H·AI·K·U`,
		description: stage.description,
	}
}

export default async function StageDetailPage({ params }: Props) {
	const { slug, stage: stageName } = await params
	const studio = getStudioBySlug(slug)
	if (!studio) notFound()

	const stageIndex = studio.stageDefinitions.findIndex(
		(s) => s.name === stageName,
	)
	const stage = studio.stageDefinitions[stageIndex]
	if (!stage) notFound()

	const prevStage =
		stageIndex > 0 ? studio.stageDefinitions[stageIndex - 1] : null
	const nextStage =
		stageIndex < studio.stageDefinitions.length - 1
			? studio.stageDefinitions[stageIndex + 1]
			: null
	const badge = reviewBadge[stage.review] || reviewBadge.ask

	const hasElaborateArtifacts =
		stage.inputs.length > 0 ||
		stage.discoveryDefinitions.length > 0 ||
		stage.phaseDefinitions.length > 0 ||
		stage.outputDefinitions.length > 0
	const hasReviewAgents =
		stage.reviewAgentDefinitions.length > 0 ||
		stage.reviewAgentsInclude.length > 0

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
				<Link
					href={`/studios/${slug}/`}
					className="hover:text-stone-900 dark:hover:text-white"
				>
					{titleCase(studio.name)}
				</Link>
				<span className="mx-2">/</span>
				<span className="text-stone-900 dark:text-white">
					{titleCase(stage.name)}
				</span>
			</nav>

			{/* Header */}
			<header className="mb-8">
				<div className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
					{titleCase(studio.name)} · stage {stageIndex + 1} of{" "}
					{studio.stageDefinitions.length}
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-4xl font-bold tracking-tight">
						{titleCase(stage.name)}
					</h1>
					<span
						className={`rounded px-2.5 py-1 text-xs font-medium ${badge.color}`}
					>
						{badge.label} gate
					</span>
				</div>
				<p className="mt-2 text-lg text-stone-600 dark:text-stone-400">
					{stage.description}
				</p>
			</header>

			{/* Stage overview — STAGE.md prose */}
			{stage.content && (
				<section className="mb-12 rounded-xl border border-stone-200 bg-stone-50/60 px-6 py-5 dark:border-stone-800 dark:bg-stone-900/40">
					<div className="prose prose-sm prose-stone dark:prose-invert max-w-none prose-headings:scroll-mt-20">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeSlug]}
						>
							{stage.content}
						</ReactMarkdown>
					</div>
				</section>
			)}

			{/* Phase-ordered lifecycle */}
			<h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-stone-400">
				How the engine runs this stage
			</h2>
			<div className="space-y-2">
				{/* 1 — Elaborate */}
				{hasElaborateArtifacts && (
					<PhaseSection
						accent="elaborate"
						step={1}
						label="Elaborate"
						caption={
							stage.elaboration
								? `${stage.elaboration} · plan the work, fan out discovery, declare outputs`
								: "plan the work, fan out discovery, declare outputs"
						}
					>
						<div className="space-y-4">
							{stage.inputs.length > 0 && (
								<div>
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
										Inputs consumed
									</h4>
									<div className="flex flex-wrap gap-2">
										{stage.inputs.map((inp) => (
											<Link
												key={`${inp.stage}-${inp.output}`}
												href={`/studios/${slug}/stages/${inp.stage}/`}
												className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs hover:border-teal-300 dark:border-stone-700 dark:hover:border-teal-700"
											>
												<span className="font-medium text-stone-700 dark:text-stone-200">
													{inp.output}
												</span>
												<span className="text-stone-400">
													from {titleCase(inp.stage)}
												</span>
											</Link>
										))}
									</div>
								</div>
							)}
							{stage.discoveryDefinitions.length > 0 && (
								<div>
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
										Discovery fan-out
									</h4>
									<div className="space-y-2">
										{stage.discoveryDefinitions.map((def) => (
											<ExpandableArtifact
												key={def.name}
												def={def}
												eyebrow="knowledge artifact"
											/>
										))}
									</div>
								</div>
							)}
							{stage.phaseDefinitions.length > 0 && (
								<div>
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
										Phase guidance
									</h4>
									<div className="space-y-2">
										{stage.phaseDefinitions.map((def) => (
											<ExpandableArtifact
												key={def.name}
												def={def}
												eyebrow="phase override"
											/>
										))}
									</div>
								</div>
							)}
							{stage.outputDefinitions.length > 0 && (
								<div>
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
										Outputs produced
									</h4>
									<div className="space-y-2">
										{stage.outputDefinitions.map((def) => (
											<ExpandableArtifact
												key={def.name}
												def={def}
												eyebrow="output template"
											/>
										))}
									</div>
								</div>
							)}
						</div>
					</PhaseSection>
				)}

				{/* 2 — Review (pre-execute) */}
				{hasReviewAgents && (
					<PhaseSection
						accent="review"
						step={2}
						label="Review"
						caption="pre-execute · agents audit the planned spec before any code lands"
					>
						<div className="space-y-2">
							{stage.reviewAgentDefinitions.map((agent) => (
								<ExpandableArtifact
									key={agent.name}
									def={agent}
									id={`agent-${agent.name}`}
									eyebrow="review agent"
								/>
							))}
							{stage.reviewAgentsInclude.length > 0 && (
								<div className="rounded-lg border border-dashed border-stone-300 px-4 py-3 dark:border-stone-600">
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
										Borrowed from other stages
									</h4>
									<div className="flex flex-wrap gap-2">
										{stage.reviewAgentsInclude.flatMap((inc) =>
											inc.agents.map((agentName) => (
												<Link
													key={`${inc.stage}-${agentName}`}
													href={`/studios/${slug}/stages/${inc.stage}/#agent-${agentName}`}
													className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm hover:border-teal-300 dark:border-stone-700 dark:hover:border-teal-700"
												>
													<span className="font-medium">
														{titleCase(agentName)}
													</span>
													<span className="ml-1 text-stone-400">
														from {titleCase(inc.stage)}
													</span>
												</Link>
											)),
										)}
									</div>
								</div>
							)}
						</div>
					</PhaseSection>
				)}

				{/* 3 — Execute */}
				{stage.hatDefinitions.length > 0 && (
					<PhaseSection
						accent="execute"
						step={3}
						label="Execute"
						caption={`per-unit baton · ${stage.hats
							.map((h) => titleCase(h))
							.join(" → ")}`}
					>
						<div className="space-y-2">
							{stage.hatDefinitions.map((hat, i) => (
								<ExpandableArtifact
									key={hat.name}
									def={hat}
									id={hat.name}
									eyebrow={`hat ${i + 1}`}
								/>
							))}
						</div>
					</PhaseSection>
				)}

				{/* 4 — Approve (post-execute) */}
				{hasReviewAgents && (
					<PhaseSection
						accent="approve"
						step={4}
						label="Approve"
						caption="post-execute · the same agents re-run against the built work"
					>
						<p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
							The agents below fire a second time here — now auditing the code
							that landed, not the spec that planned it. Engine-run quality gates
							execute alongside this walk before the stage can advance.
						</p>
						<div className="space-y-2">
							{stage.reviewAgentDefinitions.map((agent) => (
								<ExpandableArtifact
									key={agent.name}
									def={agent}
									id={`approve-agent-${agent.name}`}
									eyebrow="approval agent"
								/>
							))}
							{stage.reviewAgentsInclude.length > 0 && (
								<div className="rounded-lg border border-dashed border-stone-300 px-4 py-3 dark:border-stone-600">
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
										Borrowed from other stages
									</h4>
									<div className="flex flex-wrap gap-2">
										{stage.reviewAgentsInclude.flatMap((inc) =>
											inc.agents.map((agentName) => (
												<Link
													key={`${inc.stage}-${agentName}`}
													href={`/studios/${slug}/stages/${inc.stage}/#agent-${agentName}`}
													className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm hover:border-teal-300 dark:border-stone-700 dark:hover:border-teal-700"
												>
													<span className="font-medium">
														{titleCase(agentName)}
													</span>
													<span className="ml-1 text-stone-400">
														from {titleCase(inc.stage)}
													</span>
												</Link>
											)),
										)}
									</div>
								</div>
							)}
						</div>
					</PhaseSection>
				)}

				{/* 5 — Gate */}
				<PhaseSection
					accent="gate"
					step={5}
					label="Gate"
					caption="controls advancement to the next stage"
				>
					<div className="flex items-center gap-3">
						<span
							className={`rounded px-2.5 py-1 text-xs font-medium ${badge.color}`}
						>
							{badge.label}
						</span>
						<p className="text-sm text-stone-500 dark:text-stone-400">
							{gateExplanation(stage.review)}
						</p>
					</div>
				</PhaseSection>
			</div>

			{/* Fix loop — a separate track (Track B), not a step in the linear walk */}
			{stage.fixHatChain.length > 0 && (
				<section className="mt-12 rounded-xl border-l-4 border border-amber-300 bg-amber-50/40 px-6 py-5 dark:border-amber-800/60 dark:bg-amber-950/20">
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2 className="text-sm font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
							Fix loop
						</h2>
						<span className="text-xs text-stone-500 dark:text-stone-400">
							a separate track · {stage.fixHatChain
								.map((h) => titleCase(h.name))
								.join(" → ")}
						</span>
					</div>
					<p className="mt-2 max-w-2xl text-sm text-stone-600 dark:text-stone-400">
						Not a step in the walk above. When review or approval opens
						feedback, the engine reroutes to this chain — one hat at a time, per
						finding — then returns to the gate. It runs only when there&apos;s a
						finding to fix.
					</p>
					<div className="mt-4 space-y-2">
						{stage.fixHatChain.map((hat, i) => (
							<ExpandableArtifact
								key={`${hat.name}-${i}`}
								def={hat}
								id={`fix-${hat.name}`}
								eyebrow={`fix-hat ${i + 1}`}
							/>
						))}
					</div>
				</section>
			)}

			{/* Navigation */}
			<footer className="mt-12 flex items-center justify-between border-t border-stone-200 pt-8 dark:border-stone-800">
				{prevStage ? (
					<Link
						href={`/studios/${slug}/stages/${prevStage.name}/`}
						className="text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
					>
						&larr; {titleCase(prevStage.name)}
					</Link>
				) : (
					<Link
						href={`/studios/${slug}/`}
						className="text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
					>
						&larr; {titleCase(studio.name)} Overview
					</Link>
				)}
				{nextStage ? (
					<Link
						href={`/studios/${slug}/stages/${nextStage.name}/`}
						className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
					>
						{titleCase(nextStage.name)} &rarr;
					</Link>
				) : (
					<Link
						href={`/studios/${slug}/`}
						className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
					>
						Back to overview &rarr;
					</Link>
				)}
			</footer>
		</div>
	)
}

function gateExplanation(review: string): string {
	switch (review) {
		case "auto":
			return "The harness advances automatically — no human in the loop at this gate."
		case "ask":
			return "A local review UI opens; a human approves or requests changes via the review tool."
		case "external":
			return "Blocks until an external system (GitHub/GitLab) signals approval, usually via branch merge."
		case "external, ask":
			return "The user chooses: submit for external review, or approve locally."
		case "await":
			return "Blocks until an external event occurs — a customer response, a pipeline, a webhook."
		default:
			return "Controls whether work advances to the next stage."
	}
}
