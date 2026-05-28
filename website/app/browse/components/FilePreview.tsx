"use client"

import type { BrowseProvider, HaikuAsset } from "@/lib/browse/types"
import { AuthenticatedMedia } from "./AuthenticatedMedia"
import { BrowseMarkdown } from "./BrowseMarkdown"
import { RenderedHtmlFrame } from "./RenderedHtmlFrame"
import {
	KiCanvasViewer,
	ModelViewer,
	TracespaceViewer,
	TscircuitViewer,
} from "./SpecializedViewers"

// FilePreview — one renderer that dispatches a file to the right view by its
// extension. Used wherever browse surfaces an arbitrary file (stage assets,
// unit outputs): markdown → markdown, image/video/audio → media handlers,
// source code → syntax-highlighted block, HTML → sandboxed iframe, PDF →
// embedded viewer, and anything else with text → a plain <pre>; a binary with
// no handler falls through to a download link. The goal is "every output type
// renders" with a graceful, predictable fallback chain.

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i
const VIDEO_RE = /\.(mp4|webm|ogv|mov|m4v)$/i
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|flac|aac)$/i

/** Map a file extension to a highlight.js language hint. Anything not listed
 *  falls back to highlight.js auto-detection (still renders, just unhinted). */
const CODE_LANG: Record<string, string> = {
	// rehype-highlight's `common` set has no separate `tsx`/`jsx` grammar —
	// the typescript/javascript grammars handle them. Mapping to a registered
	// language id is what makes tokens (and thus colors) appear at all.
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	kt: "kotlin",
	swift: "swift",
	c: "c",
	h: "c",
	cpp: "cpp",
	cc: "cpp",
	hpp: "cpp",
	cs: "csharp",
	php: "php",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	sql: "sql",
	graphql: "graphql",
	gql: "graphql",
	json: "json",
	jsonc: "json",
	jsonl: "json",
	ndjson: "json",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	ini: "ini",
	css: "css",
	scss: "scss",
	less: "less",
	dockerfile: "dockerfile",
	makefile: "makefile",
	lua: "lua",
	r: "r",
	dart: "dart",
	proto: "protobuf",
	tf: "hcl",
	hcl: "hcl",
	xml: "xml",
	vue: "xml",
	svelte: "xml",
}

function ext(name: string): string {
	const base = name.split("/").pop() ?? name
	const dot = base.lastIndexOf(".")
	return dot >= 0 ? base.slice(dot + 1).toLowerCase() : base.toLowerCase()
}

/** True when the file's bytes should be rendered inline as text (markdown,
 *  source, config, logs) rather than fetched as a binary URL. */
export function isTextFile(name: string): boolean {
	const e = ext(name)
	if (e in CODE_LANG) return true
	return [
		"md",
		"markdown",
		"mdx",
		"txt",
		"text",
		"log",
		"csv",
		"tsv",
		"env",
		"gitignore",
		"editorconfig",
		"properties",
		"feature",
		"diff",
		"patch",
		"html",
		"htm",
	].includes(e)
}

interface Props {
	/** Filename or stage/intent-relative path — drives type detection + label. */
	name: string
	/** Inline text content (markdown, source, config). */
	content?: string | null
	/** URL for binary media (image / video / audio / pdf). */
	rawUrl?: string | null
	/** Host for authenticated media fetches (git providers). */
	host?: string
	/** Intent assets for resolving relative image refs inside markdown. */
	assets?: HaikuAsset[]
	/** Base path for markdown relative-ref resolution. */
	basePath?: string
	/** Provider + baseDir let an HTML file resolve its relative assets. */
	provider?: BrowseProvider
	baseDir?: string
}

export function FilePreview({
	name,
	content,
	rawUrl,
	host,
	assets,
	basePath,
	provider,
	baseDir,
}: Props) {
	const e = ext(name)

	// Markdown — full rich render with asset-resolved images.
	if (e === "md" || e === "markdown" || e === "mdx") {
		return (
			<div className="prose prose-sm prose-stone max-w-none dark:prose-invert">
				<BrowseMarkdown assets={assets} host={host} basePath={basePath}>
					{content ?? ""}
				</BrowseMarkdown>
			</div>
		)
	}

	// HTML — sandboxed iframe; resolve relative assets when we can.
	if (e === "html" || e === "htm") {
		if (content && provider && baseDir) {
			return (
				<RenderedHtmlFrame
					html={content}
					baseDir={baseDir}
					provider={provider}
					title={name}
					className="h-[70vh] w-full rounded-lg border border-stone-200 dark:border-stone-700"
				/>
			)
		}
		if (content) {
			return (
				<iframe
					srcDoc={content}
					title={name}
					sandbox="allow-scripts"
					className="h-[70vh] w-full rounded-lg border border-stone-200 dark:border-stone-700"
				/>
			)
		}
	}

	// Image — authenticated when behind a git host, else a plain <img>.
	if (IMAGE_RE.test(name) && rawUrl) {
		if (host) {
			return (
				<AuthenticatedMedia
					rawUrl={rawUrl}
					name={name}
					host={host}
					className="max-h-[70vh] max-w-full rounded-lg"
					fullSize
				/>
			)
		}
		return (
			// biome-ignore lint/performance/noImgElement: arbitrary provider URL; next/image can't allowlist user repos
			<img
				src={rawUrl}
				alt={name}
				className="max-h-[70vh] max-w-full rounded-lg"
			/>
		)
	}

	// Video / audio — native players.
	if (VIDEO_RE.test(name) && rawUrl) {
		return (
			// biome-ignore lint/a11y/useMediaCaption: artifact videos have no caption track
			<video
				src={rawUrl}
				controls
				className="max-h-[70vh] max-w-full rounded-lg"
			/>
		)
	}
	if (AUDIO_RE.test(name) && rawUrl) {
		// biome-ignore lint/a11y/useMediaCaption: artifact audio has no caption track
		return <audio src={rawUrl} controls className="w-full" />
	}

	// PDF — embedded viewer.
	if (e === "pdf" && rawUrl) {
		return (
			<iframe
				src={rawUrl}
				title={name}
				className="h-[80vh] w-full rounded-lg border border-stone-200 dark:border-stone-700"
			/>
		)
	}

	// Engineering / 3D binaries — the same specialized viewers the stage
	// artifact grid uses, so hwdev outputs (schematics, gerbers, models,
	// tscircuit) render the same way wherever they surface.
	if (rawUrl) {
		const lower = name.toLowerCase()
		if (/\.(kicad_sch|kicad_pcb|kicad_pro)$/.test(lower)) {
			return <KiCanvasViewer url={rawUrl} name={name} />
		}
		if (/\.(gbr|drl)$/.test(lower)) {
			return <TracespaceViewer url={rawUrl} name={name} />
		}
		if (/\.(glb|gltf)$/.test(lower)) {
			return <ModelViewer url={rawUrl} name={name} />
		}
		if (/\.circuit\.tsx$/.test(lower)) {
			return <TscircuitViewer url={rawUrl} name={name} />
		}
	}

	// Source code / config — syntax-highlighted via a fenced markdown block
	// (rehype-highlight styles it through globals.css `.hljs`). Auto-detect
	// when the extension isn't mapped.
	if (content != null && (e in CODE_LANG || isTextFile(name))) {
		const lang = CODE_LANG[e] ?? ""
		// Fence with a length the body can't accidentally close.
		const fence = "```"
		return (
			<div className="prose prose-sm prose-stone max-w-none dark:prose-invert">
				<BrowseMarkdown>{`${fence}${lang}\n${content}\n${fence}`}</BrowseMarkdown>
			</div>
		)
	}

	// Any other text we happen to have — plain monospace.
	if (content != null && content.length > 0) {
		return (
			<pre className="overflow-x-auto rounded-lg border border-stone-200 bg-stone-50 p-4 text-xs leading-relaxed text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
				{content}
			</pre>
		)
	}

	// Binary with no inline handler — offer the download.
	return (
		<div className="rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-700">
			<span className="font-mono text-sm text-stone-600 dark:text-stone-400">
				{name}
			</span>
			{rawUrl && (
				<a
					href={rawUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="ml-2 text-xs text-teal-600 hover:underline dark:text-teal-400"
				>
					Download
				</a>
			)}
		</div>
	)
}
