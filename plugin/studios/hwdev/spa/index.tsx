/**
 * hwdev Board Explorer — studio-contributed app for the hwdev studio.
 *
 * The default mime dispatch renders a single artifact at a time. A
 * board is meaningless in isolation: a schematic without its PCB,
 * BOM, and 3D model is half a story. This component fans the current
 * artifact's directory out into multiple panes and lets the user
 * tab between related artifacts without leaving the page.
 *
 * Loaded by `packages/haiku-ui/src/studio-apps/registry.ts` via
 * Vite's `import.meta.glob`. Receives `{ url, artifact, intent,
 * stage, name }` from ViewPage. Renders schematic / PCB / 3D / BOM
 * panes as appropriate based on the artifact's neighbours.
 */

import { useEffect, useRef, useState } from "react"
import type { ReactElement } from "react"

const loadedScripts = new Set<string>()

function injectModule(src: string): void {
	if (loadedScripts.has(src) || typeof document === "undefined") return
	loadedScripts.add(src)
	if (document.querySelector(`script[data-haiku-hwdev-src="${src}"]`)) return
	const s = document.createElement("script")
	s.type = "module"
	s.src = src
	s.setAttribute("data-haiku-hwdev-src", src)
	document.head.appendChild(s)
}

// Same CDN entries the default-pipeline SpecializedViewers use.
// Keeping them in sync is a known coupling — when those move, this
// follows; both stay declared at the same module-level constant
// shape so a `grep` finds them together.
const KICANVAS_SRC = "https://kicanvas.org/kicanvas/kicanvas.js"
const MODEL_VIEWER_SRC =
	"https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"

declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			"kicanvas-embed": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement> & {
					src?: string
					controls?: string
					theme?: string
				},
				HTMLElement
			>
			"model-viewer": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement> & {
					src?: string
					alt?: string
					"auto-rotate"?: boolean | string
					"camera-controls"?: boolean | string
					"shadow-intensity"?: string
				},
				HTMLElement
			>
		}
	}
}

interface HwdevExplorerProps {
	url: string
	artifact: string
	intent: string
	stage?: string
	name: string
}

type Pane = "current" | "schematic" | "pcb" | "model3d" | "bom"

function detectFamily(path: string): Pane {
	const p = path.toLowerCase()
	if (p.endsWith(".kicad_sch") || p.includes("schematic")) return "schematic"
	if (
		p.endsWith(".kicad_pcb") ||
		p.endsWith(".gbr") ||
		p.endsWith(".drl") ||
		p.includes("pcb") ||
		p.includes("gerber")
	) {
		return "pcb"
	}
	if (p.endsWith(".glb") || p.endsWith(".gltf") || p.includes("/3d/")) {
		return "model3d"
	}
	if (p.endsWith(".csv") || p.includes("bom")) return "bom"
	return "current"
}

export default function HwdevBoardExplorer({
	url,
	artifact,
	intent,
	stage,
	name,
}: HwdevExplorerProps): ReactElement {
	useEffect(() => {
		injectModule(KICANVAS_SRC)
		injectModule(MODEL_VIEWER_SRC)
	}, [])

	const family = detectFamily(artifact)
	const [activePane, setActivePane] = useState<Pane>(family)

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2 rounded border border-stone-200 bg-stone-50 p-2 text-xs dark:border-stone-700 dark:bg-stone-900">
				<span className="font-mono text-stone-600 dark:text-stone-300">
					hwdev board explorer · {intent}
					{stage ? ` / ${stage}` : ""}
				</span>
				<span className="text-stone-400 dark:text-stone-600">|</span>
				{(["current", "schematic", "pcb", "model3d", "bom"] as const).map(
					(p) => (
						<button
							type="button"
							key={p}
							onClick={() => setActivePane(p)}
							className={
								activePane === p
									? "rounded bg-teal-600 px-2 py-0.5 text-white dark:bg-teal-500"
									: "rounded border border-stone-300 px-2 py-0.5 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
							}
						>
							{p}
						</button>
					),
				)}
				<span className="ml-auto text-stone-500 dark:text-stone-400">
					detected family: {family}
				</span>
			</div>

			{activePane === "current" ? (
				<CurrentArtifactPane url={url} artifact={artifact} name={name} />
			) : activePane === "schematic" ? (
				<SchematicPane url={url} name={name} family={family} />
			) : activePane === "pcb" ? (
				<PCBPane url={url} name={name} family={family} />
			) : activePane === "model3d" ? (
				<ModelPane url={url} name={name} family={family} />
			) : (
				<BOMPane url={url} name={name} family={family} />
			)}

			<p className="text-xs text-stone-500 dark:text-stone-400">
				This is the hwdev studio's contributed explorer. It picks up
				`.kicad_sch` / `.kicad_pcb` / `.gbr` / `.glb` / `.gltf` artifacts
				and lays them out as related panes. The default SPA pipeline
				handles everything else.
			</p>
		</div>
	)
}

function CurrentArtifactPane({
	url,
	artifact,
	name,
}: {
	url: string
	artifact: string
	name: string
}): ReactElement {
	const p = artifact.toLowerCase()
	if (p.endsWith(".kicad_sch") || p.endsWith(".kicad_pcb")) {
		return <KiCanvasPane url={url} name={name} />
	}
	if (p.endsWith(".glb") || p.endsWith(".gltf")) {
		return <ModelPane url={url} name={name} family="model3d" />
	}
	return (
		<div className="rounded border border-stone-200 p-6 text-sm dark:border-stone-700">
			Showing the explorer's overview for{" "}
			<code className="font-mono">{artifact}</code>. Switch panes above to
			focus on schematic, PCB, 3D, or BOM views.
		</div>
	)
}

function SchematicPane({
	url,
	name,
	family,
}: {
	url: string
	name: string
	family: Pane
}): ReactElement {
	if (family !== "schematic") {
		return (
			<EmptyPane label="schematic" hint="Open a `.kicad_sch` to populate this pane." />
		)
	}
	return <KiCanvasPane url={url} name={name} />
}

function PCBPane({
	url,
	name,
	family,
}: {
	url: string
	name: string
	family: Pane
}): ReactElement {
	if (family !== "pcb") {
		return (
			<EmptyPane
				label="PCB"
				hint="Open a `.kicad_pcb` or `.gbr` set to populate this pane."
			/>
		)
	}
	return <KiCanvasPane url={url} name={name} />
}

function ModelPane({
	url,
	name,
	family,
}: {
	url: string
	name: string
	family: Pane
}): ReactElement {
	if (family !== "model3d") {
		return (
			<EmptyPane
				label="3D model"
				hint="Open a `.glb` or `.gltf` to populate this pane."
			/>
		)
	}
	return (
		<div className="h-[70vh] w-full rounded border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-950">
			<model-viewer
				src={url}
				alt={name}
				auto-rotate=""
				camera-controls=""
				shadow-intensity="1"
				style={{ width: "100%", height: "100%" }}
			/>
		</div>
	)
}

function BOMPane({
	url,
	name,
	family,
}: {
	url: string
	name: string
	family: Pane
}): ReactElement {
	const [content, setContent] = useState<string | null>(null)
	const ref = useRef<AbortController | null>(null)
	useEffect(() => {
		if (family !== "bom") return
		ref.current?.abort()
		const ctrl = new AbortController()
		ref.current = ctrl
		fetch(url, { signal: ctrl.signal })
			.then((r) => r.text())
			.then((t) => setContent(t))
			.catch(() => {
				/* noop */
			})
		return () => {
			ctrl.abort()
		}
	}, [url, family])
	if (family !== "bom") {
		return (
			<EmptyPane
				label="BOM"
				hint="Open a `.csv` (or a file with `bom` in the path) to populate this pane."
			/>
		)
	}
	return (
		<pre
			className="max-h-[70vh] overflow-auto rounded border border-stone-200 bg-stone-50 p-4 font-mono text-xs dark:border-stone-700 dark:bg-stone-950"
			data-testid="hwdev-bom"
		>
			{content ?? `Loading ${name}…`}
		</pre>
	)
}

function KiCanvasPane({
	url,
	name,
}: {
	url: string
	name: string
}): ReactElement {
	return (
		<div className="h-[70vh] w-full rounded border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-950">
			<kicanvas-embed src={url} controls="full" theme="kicad" />
			<noscript>
				<a href={url}>Download {name}</a>
			</noscript>
		</div>
	)
}

function EmptyPane({
	label,
	hint,
}: {
	label: string
	hint: string
}): ReactElement {
	return (
		<div className="rounded border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
			<p className="font-medium text-stone-700 dark:text-stone-200">
				{label} pane
			</p>
			<p className="mt-1">{hint}</p>
		</div>
	)
}
