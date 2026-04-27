// app/lifecycles/[studio]/page.tsx — Per-studio workflow diagram
// detail page. Reads the auto-generated .mmd file at build time and
// renders it via the existing client-side Mermaid component.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Mermaid } from "../../components/Mermaid"

interface Props {
	params: Promise<{ studio: string }>
}

function diagramPath(studio: string): string {
	return join(process.cwd(), "public", "workflow-diagrams", `${studio}.mmd`)
}

export async function generateStaticParams() {
	try {
		const dir = join(process.cwd(), "public", "workflow-diagrams")
		return readdirSync(dir)
			.filter((f) => f.endsWith(".mmd"))
			.map((f) => ({ studio: f.replace(/\.mmd$/, "") }))
	} catch {
		return []
	}
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { studio } = await params
	return {
		title: `${studio} lifecycle - H·AI·K·U`,
		description: `Auto-generated workflow state diagram for the ${studio} studio.`,
	}
}

export default async function StudioLifecyclePage({ params }: Props) {
	const { studio } = await params
	const path = diagramPath(studio)
	if (!existsSync(path)) {
		notFound()
	}
	const chart = readFileSync(path, "utf8")

	return (
		<div className="mx-auto max-w-6xl px-6 py-12">
			<div className="mb-6">
				<Link
					href="/lifecycles"
					className="text-sm text-stone-500 hover:text-blue-600 dark:text-stone-400 dark:hover:text-blue-400"
				>
					← All lifecycles
				</Link>
			</div>

			<h1 className="mb-2 font-mono text-4xl font-bold tracking-tight">
				{studio}
			</h1>
			<p className="mb-8 text-sm text-stone-500 dark:text-stone-400">
				Auto-generated from the StudioConfig. Re-run{" "}
				<code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
					bun run --cwd packages/haiku export:workflow-diagrams
				</code>{" "}
				to regenerate after a studio change.
			</p>

			<div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
				<Mermaid chart={chart} />
			</div>

			<details className="mt-6 text-sm">
				<summary className="cursor-pointer text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200">
					View Mermaid source ({chart.split("\n").length} lines)
				</summary>
				<pre className="mt-3 overflow-x-auto rounded bg-stone-100 p-4 text-xs dark:bg-stone-800">
					{chart}
				</pre>
			</details>
		</div>
	)
}
