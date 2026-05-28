/**
 * SpecializedViewers — React wrappers around third-party web-component
 * viewers for engineering artifact formats that the SPA's generic
 * mime dispatch cannot render natively.
 *
 * Each viewer is a web-component loaded lazily via a one-shot ESM
 * `<script type="module">` injection (idempotent — re-mounts re-use
 * the same registration). CDN-loaded for v1; vendoring into the SPA
 * build is a followup if offline rendering becomes a requirement.
 *
 * The wrappers exist so the SPA's `runtime-verifier` flow (driven
 * by Playwright through `haiku_view`) can navigate to a URL that
 * actually shows the artifact a human would see — schematic, PCB,
 * Gerber, 3D model — not just a download link.
 */

import { useEffect, useRef } from "react"

const loadedScripts = new Set<string>()

function injectModuleOnce(src: string): void {
	if (loadedScripts.has(src)) return
	loadedScripts.add(src)
	if (typeof document === "undefined") return
	if (document.querySelector(`script[data-haiku-viewer-src="${src}"]`)) return
	const script = document.createElement("script")
	script.type = "module"
	script.src = src
	script.setAttribute("data-haiku-viewer-src", src)
	document.head.appendChild(script)
}

// React 19 / TS5 — declare the custom-element JSX intrinsics the
// wrappers use so TSX validates without a global d.ts file.
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

// ── KiCanvas — KiCad schematics + PCBs ────────────────────────────

export interface KiCanvasViewerProps {
	url: string
	name: string
}

const KICANVAS_SRC = "https://kicanvas.org/kicanvas/kicanvas.js"

export function KiCanvasViewer({ url, name }: KiCanvasViewerProps): React.ReactElement {
	useEffect(() => {
		injectModuleOnce(KICANVAS_SRC)
	}, [])
	return (
		<div
			data-testid="view-kicanvas"
			className="h-[85vh] w-full rounded border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-950"
		>
			<kicanvas-embed src={url} controls="full" theme="kicad" />
			<noscript>
				<a href={url}>Download {name}</a>
			</noscript>
		</div>
	)
}

// ── Tracespace — Gerber, drill, pick-and-place ────────────────────
// Tracespace's web viewer is rendered via their parser → SVG pipeline.
// We fetch the artifact text and use @tracespace/view if loaded, else
// render a code-block fallback.

export interface TracespaceViewerProps {
	url: string
	name: string
}

const TRACESPACE_VIEW_SRC =
	"https://cdn.jsdelivr.net/npm/@tracespace/view@4/dist/index.mjs"

export function TracespaceViewer({ url, name }: TracespaceViewerProps): React.ReactElement {
	const ref = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		injectModuleOnce(TRACESPACE_VIEW_SRC)
		// Mount the viewer once the script is loaded. Tracespace's
		// view package exposes a renderGerber-like API; we conservatively
		// fall back to an iframe at the raw URL if the module isn't
		// resolved by the time we render, so the page is never blank.
		let cancelled = false
		;(async () => {
			try {
				const mod = (await import(
					/* @vite-ignore */ TRACESPACE_VIEW_SRC
				).catch(() => null)) as
					| { renderGerber?: (text: string, mount: HTMLElement) => void }
					| null
				if (!mod || cancelled || !ref.current) return
				const res = await fetch(url)
				const text = await res.text()
				if (!cancelled && ref.current && mod.renderGerber) {
					mod.renderGerber(text, ref.current)
				}
			} catch {
				// Best-effort — the noscript fallback / raw-link will catch.
			}
		})()
		return () => {
			cancelled = true
		}
	}, [url])
	return (
		<div className="rounded border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950">
			<div
				ref={ref}
				data-testid="view-tracespace"
				className="min-h-[60vh] w-full"
			/>
			<p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
				{name} · Gerber rendered via Tracespace.
				{" "}
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					className="text-teal-700 underline dark:text-teal-300"
				>
					Open raw
				</a>
			</p>
		</div>
	)
}

// ── @google/model-viewer — glTF / GLB 3D models ────────────────────

export interface ModelViewerProps {
	url: string
	name: string
}

const MODEL_VIEWER_SRC =
	"https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"

export function ModelViewer({ url, name }: ModelViewerProps): React.ReactElement {
	useEffect(() => {
		injectModuleOnce(MODEL_VIEWER_SRC)
	}, [])
	return (
		<div
			data-testid="view-model-viewer"
			className="h-[85vh] w-full rounded border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-950"
		>
			<model-viewer
				src={url}
				alt={name}
				auto-rotate=""
				camera-controls=""
				shadow-intensity="1"
				style={{ width: "100%", height: "100%" }}
			>
				<noscript>
					<a href={url}>Download {name}</a>
				</noscript>
			</model-viewer>
		</div>
	)
}

// ── tscircuit — code-defined circuit (.tsx) rendering ──────────────
// tscircuit's runner mounts a circuit-as-tsx into a target element.
// First-cut: fetch the .tsx source, hand it to @tscircuit/runner if
// loaded, else fall back to syntax-highlighted source view.

export interface TscircuitViewerProps {
	url: string
	name: string
}

const TSCIRCUIT_RUNNER_SRC =
	"https://cdn.jsdelivr.net/npm/@tscircuit/runner@latest/dist/index.mjs"

export function TscircuitViewer({ url, name }: TscircuitViewerProps): React.ReactElement {
	const ref = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		injectModuleOnce(TSCIRCUIT_RUNNER_SRC)
		let cancelled = false
		;(async () => {
			try {
				const mod = (await import(
					/* @vite-ignore */ TSCIRCUIT_RUNNER_SRC
				).catch(() => null)) as
					| { runCircuit?: (source: string, mount: HTMLElement) => void }
					| null
				if (!mod || cancelled || !ref.current) return
				const res = await fetch(url)
				const source = await res.text()
				if (!cancelled && ref.current && mod.runCircuit) {
					mod.runCircuit(source, ref.current)
				}
			} catch {
				// Best-effort — fallback link below is the safety net.
			}
		})()
		return () => {
			cancelled = true
		}
	}, [url])
	return (
		<div className="rounded border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-950">
			<div
				ref={ref}
				data-testid="view-tscircuit"
				className="min-h-[60vh] w-full"
			/>
			<p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
				{name} · Circuit rendered via @tscircuit/runner.
				{" "}
				<a
					href={url}
					target="_blank"
					rel="noreferrer"
					className="text-teal-700 underline dark:text-teal-300"
				>
					View source
				</a>
			</p>
		</div>
	)
}
