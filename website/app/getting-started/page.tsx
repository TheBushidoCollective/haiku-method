import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
	title: "Getting Started",
	description:
		"Install the H·AI·K·U plugin for Claude Code and start using structured human-AI collaboration.",
}

export default function GettingStartedPage() {
	return (
		<div className="mx-auto max-w-3xl px-4 py-12">
			<h1 className="mb-4 text-4xl font-bold">Getting Started</h1>
			<p className="mb-10 text-lg text-stone-600">
				Get up and running with H·AI·K·U in Claude Code. Install the plugin,
				configure your workspace, and start your first intent.
			</p>

			{/* Install the Plugin */}
			<section className="mb-12">
				<h2 className="mb-4 text-2xl font-bold">1. Install the Plugin</h2>
				<p className="mb-4 text-stone-600">
					H·AI·K·U is available as a Claude Code plugin. Install it from the
					marketplace:
				</p>
				<div className="space-y-4">
					<div className="rounded-lg border border-stone-200 bg-stone-900 p-4 font-mono text-sm text-stone-100">
						<div className="text-stone-400">
							# Add the H·AI·K·U marketplace
						</div>
						<div>/install haikumethod.ai/marketplace.json</div>
					</div>
					<div className="rounded-lg border border-stone-200 bg-stone-900 p-4 font-mono text-sm text-stone-100">
						<div className="text-stone-400">
							# Install the haiku-method plugin
						</div>
						<div>/install haiku-method</div>
					</div>
				</div>
				<p className="mt-3 text-sm text-stone-500">
					This installs the core H·AI·K·U framework with the 4-phase lifecycle,
					hat-based workflows, quality gates, and organizational memory.
				</p>
			</section>

			{/* Configure Your Workspace */}
			<section className="mb-12">
				<h2 className="mb-4 text-2xl font-bold">
					2. Configure Your Workspace
				</h2>
				<p className="mb-4 text-stone-600">
					H·AI·K·U artifacts live in a workspace — a standalone knowledge base
					that accumulates intents, memory, and organizational knowledge over
					time. Point your project to a workspace:
				</p>
				<div className="space-y-4">
					<div className="rounded-lg border border-stone-200 bg-stone-900 p-4 font-mono text-sm text-stone-100">
						<div className="text-stone-400">
							# Option A: Environment variable
						</div>
						<div>export HAIKU_WORKSPACE=~/haiku-workspace</div>
					</div>
					<div className="rounded-lg border border-stone-200 bg-stone-900 p-4 font-mono text-sm text-stone-100">
						<div className="text-stone-400">
							# Option B: Pointer file in your project root
						</div>
						<div>
							echo &quot;workspace: ~/haiku-workspace&quot; &gt; .haiku.yml
						</div>
					</div>
				</div>
				<p className="mt-3 text-sm text-stone-500">
					Workspaces can be local directories, shared cloud drive folders, or
					backed by a knowledge management system via MCP. They nest
					hierarchically — a company workspace contains team workspaces, which
					contain project workspaces. Memory inherits upward.
				</p>
			</section>

			{/* Start Your First Intent */}
			<section className="mb-12">
				<h2 className="mb-4 text-2xl font-bold">3. Start Your First Intent</h2>
				<p className="mb-4 text-stone-600">
					With the plugin installed and workspace configured, use the built-in
					skills to begin:
				</p>
				<div className="space-y-4">
					<div className="rounded-lg border border-stone-200 bg-stone-900 p-4 font-mono text-sm text-stone-100">
						<div className="text-stone-400">
							# Elaborate your first intent
						</div>
						<div>/elaborate</div>
					</div>
				</div>
				<p className="mt-3 text-sm text-stone-500">
					The Elaboration skill guides you through defining your intent, breaking
					it into units, setting success criteria, and building a domain model.
					When you're ready, use <code className="text-stone-300">/execute</code>{" "}
					to begin structured execution with hat-based workflows.
				</p>
			</section>

			{/* Available Skills */}
			<section className="mb-12">
				<h2 className="mb-4 text-2xl font-bold">Plugin Skills</h2>
				<div className="space-y-3">
					<div className="rounded-lg border border-stone-200 p-4">
						<code className="text-sm font-semibold text-teal-600">
							/elaborate
						</code>
						<p className="mt-1 text-sm text-stone-600">
							Define intent, decompose into units, set success criteria, build
							domain model.
						</p>
					</div>
					<div className="rounded-lg border border-stone-200 p-4">
						<code className="text-sm font-semibold text-teal-600">
							/execute
						</code>
						<p className="mt-1 text-sm text-stone-600">
							Execute work through hat-based workflows with iterative bolts and
							quality gates.
						</p>
					</div>
					<div className="rounded-lg border border-stone-200 p-4">
						<code className="text-sm font-semibold text-teal-600">
							/operate
						</code>
						<p className="mt-1 text-sm text-stone-600">
							Manage delivered outcomes with recurring tasks, reactive responses,
							and AI guidance.
						</p>
					</div>
					<div className="rounded-lg border border-stone-200 p-4">
						<code className="text-sm font-semibold text-teal-600">
							/reflect
						</code>
						<p className="mt-1 text-sm text-stone-600">
							Analyze outcomes, capture learnings, feed forward into
							organizational memory.
						</p>
					</div>
					<div className="rounded-lg border border-stone-200 p-4">
						<code className="text-sm font-semibold text-teal-600">
							/resume
						</code>
						<p className="mt-1 text-sm text-stone-600">
							Resume work on an existing intent from where you left off.
						</p>
					</div>
					<div className="rounded-lg border border-stone-200 p-4">
						<code className="text-sm font-semibold text-teal-600">
							/advance
						</code>
						<p className="mt-1 text-sm text-stone-600">
							Advance a unit to its next hat in the workflow.
						</p>
					</div>
				</div>
			</section>

			{/* For Software Teams */}
			<section className="mb-12">
				<h2 className="mb-4 text-2xl font-bold">For Software Teams</h2>
				<p className="mb-4 text-stone-600">
					If you're building software, install the AI-DLC profile — it extends
					H·AI·K·U with git integration, test suites, PR workflows, CI/CD
					pipelines, and deployment gates.
				</p>
				<div className="rounded-lg border border-stone-200 bg-stone-900 p-4 font-mono text-sm text-stone-100">
					<div className="text-stone-400">
						# Install AI-DLC from the H·AI·K·U marketplace
					</div>
					<div>/install ai-dlc</div>
				</div>
				<p className="mt-3 text-sm text-stone-500">
					AI-DLC provides software-specific hats, workflows, and quality gates
					pre-configured for iterative development.
				</p>
				<div className="mt-4">
					<a
						href="https://ai-dlc.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm font-medium text-teal-600 hover:text-teal-700"
					>
						Visit ai-dlc.dev for full documentation &rarr;
					</a>
				</div>
			</section>

			{/* For Other Teams */}
			<section className="mb-12">
				<h2 className="mb-4 text-2xl font-bold">For Any Domain</h2>
				<p className="mb-4 text-stone-600">
					H·AI·K·U works for any domain — marketing, operations, research,
					strategy. The core plugin gives you the full methodology. Here's the
					lifecycle:
				</p>
				<div className="space-y-6">
					<div className="rounded-xl border border-teal-200 bg-teal-50 p-6">
						<h3 className="mb-2 text-lg font-semibold text-teal-900">
							Elaboration
						</h3>
						<p className="text-sm text-teal-800">
							Define intent, decompose into units, set success criteria. This
							alone transforms how you work with AI.
						</p>
					</div>
					<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
						<h3 className="mb-2 text-lg font-semibold text-indigo-900">
							Execution
						</h3>
						<p className="text-sm text-indigo-800">
							Work through hat-based workflows in iterative bolts. Quality gates
							ensure standards before progressing.
						</p>
					</div>
					<div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
						<h3 className="mb-2 text-lg font-semibold text-amber-900">
							Operation
						</h3>
						<p className="text-sm text-amber-800">
							Manage delivered outcomes with recurring tasks, reactive responses,
							and AI-guided manual activities.
						</p>
					</div>
					<div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
						<h3 className="mb-2 text-lg font-semibold text-rose-900">
							Reflection
						</h3>
						<p className="text-sm text-rose-800">
							Analyze outcomes, capture learnings, feed forward into
							organizational memory. This is where H·AI·K·U's compounding
							advantage begins.
						</p>
					</div>
				</div>
			</section>

			{/* Mode Selection */}
			<section className="mb-12">
				<h2 className="mb-4 text-2xl font-bold">Choosing a Collaboration Mode</h2>
				<p className="mb-4 text-stone-600">
					The right mode depends on context. Use this as a starting guide:
				</p>
				<div className="space-y-4">
					<div className="rounded-lg border border-stone-200 p-4">
						<h3 className="mb-1 font-semibold">
							Use Supervised when...
						</h3>
						<p className="text-sm text-stone-600">
							The work is novel, high-risk, or foundational. You're exploring
							unfamiliar territory. Mistakes would be costly to reverse.
						</p>
					</div>
					<div className="rounded-lg border border-stone-200 p-4">
						<h3 className="mb-1 font-semibold">
							Use Observed when...
						</h3>
						<p className="text-sm text-stone-600">
							The work is somewhat familiar but requires judgment calls. You want
							to see how AI approaches the problem. You're building trust in the
							process.
						</p>
					</div>
					<div className="rounded-lg border border-stone-200 p-4">
						<h3 className="mb-1 font-semibold">
							Use Autonomous when...
						</h3>
						<p className="text-sm text-stone-600">
							The work is well-defined with verifiable success criteria. Quality
							gates can enforce standards. You trust the process and want
							efficiency.
						</p>
					</div>
				</div>
			</section>

			{/* Next Steps */}
			<div className="rounded-xl border border-stone-200 bg-stone-50 p-6">
				<h2 className="mb-4 text-lg font-semibold">Next Steps</h2>
				<div className="space-y-3">
					<Link
						href="/methodology"
						className="block text-sm font-medium text-teal-600 hover:text-teal-700"
					>
						Deep dive into the methodology &rarr;
					</Link>
					<Link
						href="/phases/elaboration"
						className="block text-sm font-medium text-teal-600 hover:text-teal-700"
					>
						Learn the Elaboration phase in detail &rarr;
					</Link>
					<Link
						href="/profiles"
						className="block text-sm font-medium text-teal-600 hover:text-teal-700"
					>
						Explore profiles and build your own &rarr;
					</Link>
					<Link
						href="/paper"
						className="block text-sm font-medium text-teal-600 hover:text-teal-700"
					>
						Read the full paper &rarr;
					</Link>
				</div>
			</div>
		</div>
	)
}
