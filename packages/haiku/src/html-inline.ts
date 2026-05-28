// html-inline.ts
//
// Inline adjacent local stylesheets into an HTML artifact so it renders
// self-contained — no artifact base URL, no sub-resource auth, no separate
// CSS-as-text/css serving (which the file-serve security posture forbids
// anyway, see path-safety.ts BLOCKED_INLINE_EXTENSIONS).
//
// Two consumers, same logic:
//   1. parser.ts — bakes the inlined body into the SPA wire payload, which
//      StageReview renders in a `srcDoc` iframe (no base URL).
//   2. http/file-serve.ts — serves the inlined body to `haiku_view`'s
//      ViewPage, which fetches it and renders via `srcDoc` (the raw
//      `/stage-artifacts` URL is forced to octet-stream/attachment, so an
//      `<iframe src=…>` can't render it directly).
//
// Lives in its own module (not in parser.ts) so the HTTP layer can import
// it without pulling parser's markdown / matter / fs-walk dependency graph.

import { readFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"

/** A local, relative href (no scheme, not protocol-relative, not
 *  root-absolute, not a fragment) — i.e. an adjacent file on disk. */
export function isLocalRelativeHref(href: string): boolean {
	return (
		href.length > 0 &&
		!/^[a-z][a-z0-9+.-]*:/i.test(href) && // http:, https:, data:, file: …
		!href.startsWith("//") && // protocol-relative
		!href.startsWith("/") && // root-absolute (resolves to SPA origin)
		!href.startsWith("#")
	)
}

/** `abs` is inside `root` (path-traversal clamp). */
export function isUnderRoot(abs: string, root: string): boolean {
	const r = root.endsWith(sep) ? root : root + sep
	return abs === root || abs.startsWith(r)
}

/**
 * Rewrite relative `url(...)` refs in a CSS string so they're expressed
 * relative to `htmlDir` instead of the CSS file's own dir (`fromDir`).
 *
 * When an adjacent stylesheet is inlined into the HTML body, its `url(bg.png)`
 * refs were authored relative to the CSS file's location — but after inlining
 * they live in a `<style>` block in the HTML, where the SPA's client-side
 * resolver treats every relative ref as relative to the HTML file's dir.
 * Re-basing them here keeps the two in sync, so a stylesheet that lives in a
 * subdir and points at `../img/x.png` resolves to the right tracked file once
 * the SPA stamps the tunnel URL. Remote / absolute / data / fragment refs are
 * left untouched. Output is always posix-separated for the browser.
 */
function rewriteCssUrls(css: string, fromDir: string, htmlDir: string): string {
	return css.replace(
		/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
		(full, _q: string, ref: string) => {
			const r = ref.trim()
			if (!isLocalRelativeHref(r)) return full
			const rel = relative(htmlDir, resolve(fromDir, r)).split(sep).join("/")
			return `url("${rel}")`
		},
	)
}

/** Read a CSS file and inline its RELATIVE `@import`s (up to a small
 *  depth) so a self-contained `<style>` results, re-basing each file's
 *  relative `url(...)` refs onto `htmlDir` as it goes. Absolute / remote
 *  imports and any import escaping `intentDir` are left as-is. */
export async function readCssInliningImports(
	cssAbs: string,
	intentDir: string,
	htmlDir: string,
	depth = 0,
): Promise<string | null> {
	if (depth > 3) return null
	let css: string
	try {
		css = await readFile(cssAbs, "utf-8")
	} catch {
		return null
	}
	const cssDir = dirname(cssAbs)
	const importRe = /@import\s+(?:url\(\s*)?["']?([^"')\s]+)["']?\s*\)?\s*;?/gi
	let out = ""
	let last = 0
	for (const m of css.matchAll(importRe)) {
		const spec = m[1]?.trim() ?? ""
		const idx = m.index ?? 0
		if (!isLocalRelativeHref(spec)) continue
		const impAbs = resolve(cssDir, spec)
		if (!isUnderRoot(impAbs, intentDir)) continue
		const inner = await readCssInliningImports(
			impAbs,
			intentDir,
			htmlDir,
			depth + 1,
		)
		if (inner == null) continue
		// This file's own segment is rebased onto `htmlDir`; `inner` already is.
		out += rewriteCssUrls(css.slice(last, idx), cssDir, htmlDir)
		out += inner
		last = idx + m[0].length
	}
	out += rewriteCssUrls(css.slice(last), cssDir, htmlDir)
	return out
}

/**
 * Inline adjacent `<link rel="stylesheet" href="relative.css">` tags into
 * the HTML body as `<style>` blocks, reading the CSS from disk relative to
 * the HTML file's directory.
 *
 * Why: HTML artifacts render in a `srcDoc` iframe (so html-to-image
 * annotation can read the inner DOM, and so the served bytes never get a
 * renderable `text/html` content-type under the tunnel origin). A `srcDoc`
 * document has no artifact base URL — relative `<link href>` resolves
 * against the SPA origin, not the artifact's dir on disk, so a wireframe
 * authored as `index.html` + `styles.css` rendered as raw, unstyled HTML
 * (reported 2026-05-20). Inlining the stylesheet makes the body
 * self-contained, so it styles correctly in srcDoc with no auth/route/
 * base-URL gymnastics. Remote (`https://…`, CDN) and root-absolute links
 * are left untouched; only local adjacent files are inlined, clamped to
 * `intentDir` for path safety. Relative `url(…)` refs inside the inlined
 * CSS are re-based onto the HTML's dir (see `rewriteCssUrls`) so the SPA's
 * client-side asset-URL resolver can turn them — along with the HTML's own
 * relative `<img src>` refs — into authed tunnel URLs that load inside the
 * srcDoc (`resolveEmbeddedAssetUrls` in haiku-ui). `.js`/`.css`/`.svg`
 * sub-resources stay octet-stream-blocked at the serve layer, so scripts
 * never execute and SVG/font refs degrade gracefully.
 */
export async function inlineAdjacentStylesheets(
	html: string,
	htmlFullPath: string,
	intentDir: string,
): Promise<string> {
	if (!/<link\b/i.test(html)) return html
	const baseDir = dirname(htmlFullPath)
	const linkRe = /<link\b[^>]*>/gi
	let out = ""
	let last = 0
	for (const m of html.matchAll(linkRe)) {
		const tag = m[0]
		const idx = m.index ?? 0
		const isStylesheet = /\brel\s*=\s*["']?stylesheet["']?/i.test(tag)
		const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)
		const href = hrefMatch?.[1]
		if (!isStylesheet || !href || !isLocalRelativeHref(href)) continue
		const cssAbs = resolve(baseDir, href)
		if (!isUnderRoot(cssAbs, intentDir)) continue
		const css = await readCssInliningImports(cssAbs, intentDir, baseDir)
		if (css == null) continue
		out += html.slice(last, idx)
		out += `<style data-haiku-inlined-from="${href.replace(/"/g, "&quot;")}">\n${css}\n</style>`
		last = idx + tag.length
	}
	out += html.slice(last)
	return out
}

/** Derive the intent dir from an artifact's absolute path + its
 *  intent-dir-relative path: climb out of `fullPath` by the directory
 *  depth of `relativePath`. */
export function intentDirOf(fullPath: string, relativePath: string): string {
	const dirSegs = relativePath.split(/[/\\]+/).filter(Boolean).length - 1
	let d = dirname(fullPath)
	for (let i = 0; i < dirSegs; i++) d = dirname(d)
	return d
}
