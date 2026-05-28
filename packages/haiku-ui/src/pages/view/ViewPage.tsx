/**
 * ViewPage — full-size artifact renderer for /view/:sessionId.
 *
 * First slice: requires an explicit `?artifact=<path>` query param.
 * Dispatches on filename extension to pick a renderer (image, PDF,
 * markdown, SVG, HTML, source-code). Falls back to a download link
 * when no handler matches the type.
 *
 * Future slices add: a directory-style artifact list when no artifact
 * is specified, specialized viewers (KiCanvas / Tracespace /
 * model-viewer / tscircuit) for engineering formats, studio-app
 * contribution mounts.
 */

import type { ViewSessionPayload } from "haiku-api"
import { paths } from "haiku-api"
import { useEffect, useMemo, useState } from "react"
import { withAuthQuery } from "../../api/auth"
import {
	KiCanvasViewer,
	ModelViewer,
	TracespaceViewer,
	TscircuitViewer,
} from "../../atoms/SpecializedViewers"
import { resolveStudioApp } from "../../studio-apps/registry"
import { resolveEmbeddedAssetUrls } from "../review/shared/inline-asset-urls"

export interface ViewPageProps {
	sessionId: string
	session: ViewSessionPayload
	stage?: string
	artifact?: string
}

type RenderKind =
	| "image"
	| "pdf"
	| "svg"
	| "html"
	| "markdown"
	| "code"
	| "text"
	| "kicad"
	| "gerber"
	| "model3d"
	| "tscircuit"
	| "unknown"

const EXTENSIONS_BY_KIND: Record<RenderKind, readonly string[]> = {
	image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico"],
	pdf: ["pdf"],
	svg: ["svg"],
	html: ["html", "htm"],
	markdown: ["md", "markdown", "mdx"],
	code: [
		"ts",
		"js",
		"jsx",
		"py",
		"go",
		"rs",
		"java",
		"kt",
		"swift",
		"rb",
		"sh",
		"yaml",
		"yml",
		"json",
		"toml",
		"css",
		"scss",
		"sql",
		"feature",
	],
	text: ["txt", "log", "csv", "tsv"],
	// KiCad — schematics (.kicad_sch), PCBs (.kicad_pcb), worksheets
	// (.kicad_wks), symbol/footprint libs (.kicad_sym, .kicad_mod).
	// Rendered by KiCanvas.
	kicad: ["kicad_sch", "kicad_pcb", "kicad_wks", "kicad_sym", "kicad_mod"],
	// Gerber + drill + pick-and-place. The various Gerber extension
	// conventions (.gbr, .gbl, .gtl, .gto, .gko, .gm1, .drl, .xln) all
	// route through Tracespace.
	gerber: [
		"gbr",
		"gbl",
		"gtl",
		"gto",
		"gtp",
		"gbp",
		"gko",
		"gm1",
		"drl",
		"xln",
	],
	// glTF 2.0 binary and JSON variants. Rendered by @google/model-viewer.
	model3d: ["glb", "gltf"],
	// tscircuit code-defined circuits. The .tsx extension overlaps with
	// regular React TSX — disambiguation lives in detectKind by path
	// hints (presence of `circuit` / `tscircuit` in path components).
	tscircuit: [],
	unknown: [],
}

function detectKind(artifactPath: string): RenderKind {
	const lowerPath = artifactPath.toLowerCase()
	// Multi-segment extensions (kicad_sch etc.) — match before the
	// generic single-extension lookup so .kicad_sch doesn't fall into
	// the `code` bucket via the `sch` tail.
	for (const ext of EXTENSIONS_BY_KIND.kicad) {
		if (lowerPath.endsWith(`.${ext}`)) return "kicad"
	}
	// tscircuit disambiguation: a .tsx file under a path that hints at
	// circuit content gets the tscircuit viewer; everything else falls
	// through to the code viewer.
	if (lowerPath.endsWith(".tsx")) {
		if (lowerPath.includes("tscircuit") || lowerPath.includes("/circuit")) {
			return "tscircuit"
		}
		return "code"
	}
	const dot = artifactPath.lastIndexOf(".")
	if (dot < 0) return "unknown"
	const ext = artifactPath.slice(dot + 1).toLowerCase()
	for (const [kind, exts] of Object.entries(EXTENSIONS_BY_KIND) as Array<
		[RenderKind, readonly string[]]
	>) {
		if (exts.includes(ext)) return kind
	}
	return "unknown"
}

export function ViewPage({
	sessionId,
	session,
	stage,
	artifact,
}: ViewPageProps): React.ReactElement {
	const artifactUrl = useMemo(() => {
		if (!artifact) return null
		return withAuthQuery(paths.stageArtifact(sessionId, artifact))
	}, [sessionId, artifact])

	if (!artifact) {
		return (
			<div className="mx-auto max-w-3xl p-8">
				<h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
					Artifact viewer
				</h1>
				<p className="mt-3 text-sm text-stone-700 dark:text-stone-300">
					This view session is scoped to intent{" "}
					<code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs dark:bg-stone-800">
						{session.intent_slug}
					</code>
					{stage ? (
						<>
							{" "}
							at stage{" "}
							<code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs dark:bg-stone-800">
								{stage}
							</code>
						</>
					) : null}
					. Pass{" "}
					<code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs dark:bg-stone-800">
						?artifact=&lt;path&gt;
					</code>{" "}
					on the URL to render a specific file.
				</p>
				<p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
					Directory-style artifact browsing lands in a follow-up commit.
				</p>
			</div>
		)
	}

	if (!artifactUrl) {
		return (
			<div className="mx-auto max-w-3xl p-8 text-sm text-red-700 dark:text-red-300">
				Could not resolve artifact URL for{" "}
				<code className="font-mono">{artifact}</code>.
			</div>
		)
	}

	const kind = detectKind(artifact)
	// Studio contribution check — if the intent's studio ships a
	// per-studio app at `plugin/studios/<studio>/spa/` and the app's
	// manifest claims this kind (or `*`), the studio app handles
	// rendering instead of the default mime dispatch.
	const StudioComponent = resolveStudioApp(session.studio, kind)
	return (
		<div className="mx-auto max-w-6xl p-4">
			<div className="mb-3 flex items-center justify-between gap-4">
				<div>
					<h1
						className="font-mono text-sm text-stone-700 dark:text-stone-200"
						data-testid="view-artifact-path"
					>
						{artifact}
					</h1>
					<p className="text-xs text-stone-500 dark:text-stone-400">
						{session.intent_slug}
						{stage ? ` · ${stage}` : ""} · {kind}
						{StudioComponent ? ` · ${session.studio} app` : ""}
					</p>
				</div>
				<a
					href={artifactUrl}
					target="_blank"
					rel="noreferrer"
					className="rounded border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
				>
					Open raw
				</a>
			</div>
			{StudioComponent ? (
				<StudioComponent
					url={artifactUrl}
					artifact={artifact}
					intent={session.intent_slug}
					stage={stage ?? undefined}
					name={artifact}
				/>
			) : (
				<ArtifactRenderer kind={kind} url={artifactUrl} name={artifact} />
			)}
		</div>
	)
}

function ArtifactRenderer({
	kind,
	url,
	name,
}: {
	kind: RenderKind
	url: string
	name: string
}): React.ReactElement {
	if (kind === "image" || kind === "svg") {
		return (
			<div className="flex justify-center rounded border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950">
				<img
					src={url}
					alt={name}
					className="max-h-[80vh] max-w-full object-contain"
				/>
			</div>
		)
	}
	if (kind === "pdf") {
		return (
			<embed
				src={url}
				type="application/pdf"
				className="h-[85vh] w-full rounded border border-stone-200 dark:border-stone-700"
				data-testid="view-pdf-embed"
			/>
		)
	}
	if (kind === "html") {
		return <HtmlRenderer url={url} name={name} />
	}
	if (kind === "markdown" || kind === "code" || kind === "text") {
		return <TextRenderer url={url} kind={kind} />
	}
	if (kind === "kicad") {
		return <KiCanvasViewer url={url} name={name} />
	}
	if (kind === "gerber") {
		return <TracespaceViewer url={url} name={name} />
	}
	if (kind === "model3d") {
		return <ModelViewer url={url} name={name} />
	}
	if (kind === "tscircuit") {
		return <TscircuitViewer url={url} name={name} />
	}
	return (
		<div className="rounded border border-stone-200 bg-stone-50 p-6 text-sm dark:border-stone-700 dark:bg-stone-900">
			<p className="text-stone-700 dark:text-stone-200">
				No inline renderer for this file type.
			</p>
			<a
				href={url}
				target="_blank"
				rel="noreferrer"
				className="mt-2 inline-block text-teal-700 underline dark:text-teal-300"
			>
				Download {name}
			</a>
		</div>
	)
}

/**
 * HtmlRenderer — renders an HTML artifact (e.g. a wireframe) in a sandboxed
 * `srcDoc` iframe.
 *
 * The file-serve route forces HTML to `application/octet-stream; attachment`
 * (FB-21 — never a renderable content-type under the tunnel origin), so an
 * `<iframe src=…>` can't render it directly. We fetch the bytes (the route
 * already inlined adjacent stylesheets, so the body is self-contained and
 * styles correctly with no base URL), rewrite relative `<img>`/`srcset`/CSS
 * `url(…)` refs to authed tunnel URLs via `resolveEmbeddedAssetUrls` (so
 * raster images load), and set the result as `srcDoc`. `allow-same-origin`
 * (no `allow-scripts`) lets CSS apply without giving the artifact script
 * execution under the tunnel origin.
 */
function HtmlRenderer({
	url,
	name,
}: {
	url: string
	name: string
}): React.ReactElement {
	const [html, setHtml] = useState<string | null>(null)
	const [err, setErr] = useState<string | null>(null)
	useEffect(() => {
		let cancelled = false
		fetch(url)
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`)
				return r.text()
			})
			.then((t) => {
				// Base = the artifact's tunnel path (drop the `?t=` query) so
				// embedded refs resolve against the HTML file's dir.
				if (!cancelled) setHtml(resolveEmbeddedAssetUrls(t, url.split("?")[0]))
			})
			.catch((e: unknown) => {
				if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
			})
		return () => {
			cancelled = true
		}
	}, [url])
	if (err) {
		return (
			<div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
				Failed to load artifact: {err}
			</div>
		)
	}
	if (html === null) {
		return (
			<div className="p-4 text-sm text-stone-500 dark:text-stone-400">
				Loading…
			</div>
		)
	}
	return (
		<iframe
			title={name}
			srcDoc={html}
			sandbox="allow-same-origin"
			className="h-[85vh] w-full rounded border border-stone-200 dark:border-stone-700"
			data-testid="view-html-frame"
		/>
	)
}

function TextRenderer({
	url,
	kind,
}: {
	url: string
	kind: RenderKind
}): React.ReactElement {
	const [content, setContent] = useState<string | null>(null)
	const [err, setErr] = useState<string | null>(null)
	useEffect(() => {
		let cancelled = false
		fetch(url)
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`)
				return r.text()
			})
			.then((t) => {
				if (!cancelled) setContent(t)
			})
			.catch((e: unknown) => {
				if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
			})
		return () => {
			cancelled = true
		}
	}, [url])
	if (err) {
		return (
			<div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
				Failed to load artifact: {err}
			</div>
		)
	}
	if (content === null) {
		return (
			<div className="p-4 text-sm text-stone-500 dark:text-stone-400">
				Loading…
			</div>
		)
	}
	return (
		<pre
			className="max-h-[85vh] overflow-auto rounded border border-stone-200 bg-stone-50 p-4 font-mono text-xs text-stone-800 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
			data-testid={`view-${kind}-content`}
		>
			{content}
		</pre>
	)
}
