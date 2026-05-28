"use client"

import { useEffect, useState } from "react"
import {
	type AssetResolver,
	buildRenderableHtml,
} from "@/lib/browse/html-render"
import type { BrowseProvider } from "@/lib/browse/types"

/**
 * Render an HTML output/artifact in a sandboxed iframe with its relative
 * assets (CSS, images, fonts) resolved against the provider. Without this the
 * raw `srcDoc` has no base URL, so `./styles.css` and `./img/x.png` 404 — the
 * "relative assets broken" bug. `buildRenderableHtml` inlines adjacent
 * stylesheets and rewrites every relative ref to a provider-resolved `data:`
 * URL (works for a dragged local folder and a private git repo alike).
 *
 * Sandbox stays `allow-scripts` only (NO `allow-same-origin`) — /browse hits
 * arbitrary remote repos, so artifact HTML is untrusted; the opaque origin is
 * exactly why we inline assets as `data:` URLs instead of blob/raw URLs.
 */
export function RenderedHtmlFrame({
	html,
	baseDir,
	provider,
	title,
	className,
}: {
	html: string
	/** Repo-root-relative directory the HTML file lives in (e.g.
	 *  `.haiku/intents/<slug>/stages/<stage>/artifacts/`). Relative refs
	 *  resolve against it. */
	baseDir: string
	provider: BrowseProvider
	title: string
	className?: string
}) {
	// Start from the raw html so something paints immediately; swap in the
	// asset-resolved document once the (async) resolve + inline finishes.
	const [doc, setDoc] = useState(html)

	useEffect(() => {
		let cancelled = false
		setDoc(html)
		const resolve: AssetResolver = async (p) =>
			(await provider.resolveAssetUrl?.(p)) ?? null
		buildRenderableHtml(html, baseDir, resolve)
			.then((out) => {
				if (!cancelled) setDoc(out)
			})
			.catch(() => {
				/* leave the raw html in place — better than a blank frame */
			})
		return () => {
			cancelled = true
		}
	}, [html, baseDir, provider])

	return (
		<iframe
			srcDoc={doc}
			title={title}
			className={className}
			sandbox="allow-scripts"
		/>
	)
}
