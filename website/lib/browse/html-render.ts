/**
 * Client-side HTML artifact rendering for the browse view.
 *
 * An HTML output authored as `index.html` + `./styles.css` + `./img/x.png`
 * renders in a sandboxed `srcDoc` iframe, which has NO base URL — so every
 * relative ref (`<link href>`, `<img src>`, `srcset`, CSS `url(...)`) resolves
 * against the SPA origin and 404s. The review SPA solves this server-side
 * (inline adjacent stylesheets, rewrite refs to authed tunnel URLs); the
 * browse view has no server in the loop — it fetches files straight from a
 * dragged local folder (File System Access API) or a git provider (raw URL +
 * token). So we do the same transform CLIENT-SIDE, resolving every relative
 * ref to a blob/object URL the iframe can load with no base and no auth header.
 *
 * Mirrors the algorithm in the SPA's
 * `packages/haiku-ui/src/pages/review/shared/inline-asset-urls.ts` (resolve
 * against the HTML file's dir, leave absolute/remote/data/# refs alone,
 * DOM-based so `<script>` string literals aren't mangled) and adds the
 * `<link rel=stylesheet>` inlining the SPA does on its server.
 *
 * `resolveAssetUrl(intentRelativePath)` is the byte source: it returns a
 * directly-usable URL (a blob URL for local files, an authed-fetched blob URL
 * for git providers) or null when the file can't be resolved. The provider
 * owns that resolution; this module only orchestrates the rewrite.
 */

/**
 * Resolve a repo-root-relative file path to a URL the sandboxed `srcDoc`
 * iframe can load. MUST be a `data:` URL (or another origin-independent URL):
 * the iframe runs with an opaque origin (sandbox without `allow-same-origin`),
 * so parent-origin `blob:` URLs are cross-origin-blocked, and a git provider's
 * raw URL can't carry the auth header the iframe would need. `data:` URLs
 * inline the bytes, so they work for a dragged local file and a private-repo
 * asset alike. Returns null when the file can't be resolved.
 */
export type AssetResolver = (path: string) => Promise<string | null>

/** Map a file path's extension to a MIME type for `data:` URL construction.
 *  Covers the asset types an HTML output references (images, fonts, css). */
export function mimeFromPath(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? ""
	const map: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		webp: "image/webp",
		avif: "image/avif",
		bmp: "image/bmp",
		ico: "image/x-icon",
		css: "text/css",
		woff: "font/woff",
		woff2: "font/woff2",
		ttf: "font/ttf",
		otf: "font/otf",
	}
	return map[ext] ?? "application/octet-stream"
}

/** Read a Blob into a `data:` URL via FileReader (handles arbitrary byte
 *  lengths — base64-by-hand overflows the call stack on large files). When
 *  the blob has no type (common for File System Access File handles), re-wrap
 *  it with `fallbackMime` so the data URL carries a usable MIME. */
export function blobToDataUrl(
	blob: Blob,
	fallbackMime: string,
): Promise<string> {
	const typed = blob.type ? blob : new Blob([blob], { type: fallbackMime })
	return new Promise((resolve, reject) => {
		const fr = new FileReader()
		fr.onload = () => resolve(fr.result as string)
		fr.onerror = () => reject(fr.error)
		fr.readAsDataURL(typed)
	})
}

/** No scheme, not protocol-relative, not root-absolute, not a fragment, not
 *  a data/blob URL. */
function isLocalRelativeRef(ref: string): boolean {
	const r = ref.trim()
	return (
		r.length > 0 &&
		!/^[a-z][a-z0-9+.-]*:/i.test(r) &&
		!r.startsWith("//") &&
		!r.startsWith("/") &&
		!r.startsWith("#")
	)
}

/** Resolve a relative ref against a directory path (handles `.` / `..`).
 *  `baseDir` is an intent-relative dir like `stages/design/artifacts/`. */
export function resolveRefAgainstDir(baseDir: string, ref: string): string {
	const stack = baseDir.replace(/\/+$/, "").split("/").filter(Boolean)
	for (const seg of ref.split("/")) {
		if (seg === "" || seg === ".") continue
		if (seg === "..") {
			if (stack.length > 0) stack.pop()
			continue
		}
		stack.push(seg)
	}
	return stack.join("/")
}

/** Collect every local-relative `url(...)` ref in a CSS string. */
function collectCssUrlRefs(css: string): string[] {
	const out: string[] = []
	const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
	let m: RegExpExecArray | null = re.exec(css)
	while (m !== null) {
		const ref = m[2].trim()
		if (isLocalRelativeRef(ref)) out.push(ref)
		m = re.exec(css)
	}
	return out
}

/** Rewrite local-relative `url(...)` refs in a CSS string via `toUrl`. Refs
 *  `toUrl` can't resolve (returns null/undefined) are left untouched. */
function rewriteCssUrlRefs(
	css: string,
	toUrl: (ref: string) => string | null | undefined,
): string {
	return css.replace(
		/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
		(full, _q: string, ref: string) => {
			const r = ref.trim()
			if (!isLocalRelativeRef(r)) return full
			const resolved = toUrl(r)
			return resolved ? `url("${resolved}")` : full
		},
	)
}

/** Rewrite each URL in a `srcset` value, preserving descriptors (`1x`, `640w`). */
function rewriteSrcset(
	value: string,
	toUrl: (ref: string) => string | null | undefined,
): string {
	return value
		.split(",")
		.map((part) => {
			const trimmed = part.trim()
			if (!trimmed) return ""
			const sp = trimmed.indexOf(" ")
			const url = sp < 0 ? trimmed : trimmed.slice(0, sp)
			const rest = sp < 0 ? "" : trimmed.slice(sp)
			if (!isLocalRelativeRef(url)) return trimmed
			const resolved = toUrl(url)
			return resolved ? `${resolved}${rest}` : trimmed
		})
		.filter(Boolean)
		.join(", ")
}

/** Pull every local-relative srcset URL out of a srcset value. */
function collectSrcsetRefs(value: string): string[] {
	const out: string[] = []
	for (const part of value.split(",")) {
		const trimmed = part.trim()
		if (!trimmed) continue
		const sp = trimmed.indexOf(" ")
		const url = sp < 0 ? trimmed : trimmed.slice(0, sp)
		if (isLocalRelativeRef(url)) out.push(url)
	}
	return out
}

/**
 * Build an iframe-renderable HTML document from a raw HTML artifact, resolving
 * its relative assets against `baseDir` (the artifact's intent-relative dir,
 * e.g. `stages/design/artifacts/`) using `resolveAssetUrl`.
 *
 * Pipeline:
 *   1. Inline each `<link rel=stylesheet href="…">` whose href is local-
 *      relative: fetch the CSS text, rewrite its `url(...)` refs against the
 *      stylesheet's OWN dir, and replace the `<link>` with a `<style>`.
 *   2. Rewrite `<img src>`, `srcset`, `<… style="…url()">`, and `<style>`
 *      `url(...)` refs to resolved URLs.
 * Absolute / remote / data / fragment refs are left alone. Returns the raw
 * html unchanged when DOMParser isn't available (SSR) or the html is empty.
 */
export async function buildRenderableHtml(
	html: string,
	baseDir: string,
	resolveAssetUrl: AssetResolver,
): Promise<string> {
	if (!html || typeof DOMParser === "undefined") return html

	const doc = new DOMParser().parseFromString(html, "text/html")

	// Resolve a batch of local-relative refs (relative to `dir`) to URLs.
	const resolveBatch = async (
		dir: string,
		refs: string[],
	): Promise<Map<string, string>> => {
		const map = new Map<string, string>()
		const unique = Array.from(new Set(refs))
		await Promise.all(
			unique.map(async (ref) => {
				const path = resolveRefAgainstDir(dir, ref)
				const url = await resolveAssetUrl(path)
				if (url) map.set(ref, url)
			}),
		)
		return map
	}

	// 1. Inline local-relative stylesheets, rewriting their url() refs against
	//    the stylesheet's own directory.
	const links = Array.from(
		doc.querySelectorAll('link[rel~="stylesheet"][href]'),
	)
	await Promise.all(
		links.map(async (link) => {
			const href = link.getAttribute("href")
			if (!href || !isLocalRelativeRef(href)) return
			const cssPath = resolveRefAgainstDir(baseDir, href)
			const cssUrl = await resolveAssetUrl(cssPath)
			if (!cssUrl) return
			let cssText: string
			try {
				cssText = await (await fetch(cssUrl)).text()
			} catch {
				return
			}
			const cssDir = cssPath.replace(/[^/]*$/, "")
			const urlMap = await resolveBatch(cssDir, collectCssUrlRefs(cssText))
			const inlined = rewriteCssUrlRefs(cssText, (r) => urlMap.get(r))
			const style = doc.createElement("style")
			style.textContent = inlined
			link.replaceWith(style)
		}),
	)

	// 2. Collect every remaining local-relative ref against the HTML's dir,
	//    resolve in one batch, then rewrite.
	const srcEls = Array.from(doc.querySelectorAll("[src]"))
	const srcsetEls = Array.from(doc.querySelectorAll("[srcset]"))
	const styleAttrEls = Array.from(doc.querySelectorAll("[style]"))
	const styleEls = Array.from(doc.querySelectorAll("style"))

	const refs: string[] = []
	for (const el of srcEls) {
		const v = el.getAttribute("src")
		if (v && isLocalRelativeRef(v)) refs.push(v)
	}
	for (const el of srcsetEls) {
		const v = el.getAttribute("srcset")
		if (v) refs.push(...collectSrcsetRefs(v))
	}
	for (const el of styleAttrEls) {
		const v = el.getAttribute("style")
		if (v) refs.push(...collectCssUrlRefs(v))
	}
	for (const el of styleEls)
		refs.push(...collectCssUrlRefs(el.textContent ?? ""))

	const urlMap = await resolveBatch(baseDir, refs)
	const toUrl = (ref: string) => urlMap.get(ref.trim())

	for (const el of srcEls) {
		const v = el.getAttribute("src")
		if (v && isLocalRelativeRef(v)) {
			const u = toUrl(v)
			if (u) el.setAttribute("src", u)
		}
	}
	for (const el of srcsetEls) {
		const v = el.getAttribute("srcset")
		if (v) el.setAttribute("srcset", rewriteSrcset(v, toUrl))
	}
	for (const el of styleAttrEls) {
		const v = el.getAttribute("style")
		if (v) el.setAttribute("style", rewriteCssUrlRefs(v, toUrl))
	}
	for (const el of styleEls) {
		el.textContent = rewriteCssUrlRefs(el.textContent ?? "", toUrl)
	}

	return `<!doctype html>${doc.documentElement.outerHTML}`
}
