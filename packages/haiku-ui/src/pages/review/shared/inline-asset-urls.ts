import { authedAssetUrl } from "./asset-url"

/**
 * Resolve an HTML artifact's embedded relative refs (`<img src>`, `srcset`,
 * and CSS `url(...)` in `<style>` blocks + inline `style=`) into authed
 * tunnel URLs, so they load inside the `srcDoc` iframe both the stage-review
 * pane and `haiku_view`'s ViewPage render HTML in.
 *
 * Why this is needed: a `srcDoc` document has no base URL, so a relative
 * `<img src="logo.png">` resolves against the SPA origin and 404s — and even
 * an absolute path would 401, because the file-serve route gates on a token
 * the browser can't attach to a bare sub-resource request. We rewrite each
 * relative ref to `/stage-artifacts/<sid>/<resolved>?t=<jwt>` (the same authed
 * URL the SPA already uses for top-level image artifacts), so raster images
 * load. The server already inlines adjacent stylesheets and re-bases their
 * `url(...)` refs onto the HTML's dir (`rewriteCssUrls` in html-inline.ts), so
 * resolving everything here against the HTML file's dir is uniform.
 *
 * `htmlAssetUrl` is the HTML artifact's own tunnel URL (e.g.
 * `/stage-artifacts/<sid>/stages/design/artifacts/index.html`); refs resolve
 * against its directory. Absolute / remote / `data:` / `#` refs are left
 * alone. `href` (links, non-stylesheet `<link>`) is intentionally NOT touched
 * — only embedded sub-resources are. DOM-based so JS string literals inside
 * `<script>` are never mangled.
 *
 * Residual: `.js`/`.css`/`.svg`/font sub-resources stay octet-stream-blocked
 * at the serve layer (FB-21), so scripts never execute and SVG-as-`<img>` /
 * custom fonts degrade to system fallbacks. Raster images — the bulk of a
 * wireframe's visual fidelity — load.
 */
export function resolveEmbeddedAssetUrls(
	html: string,
	htmlAssetUrl: string | undefined | null,
): string {
	if (!html || !htmlAssetUrl) return html
	if (typeof DOMParser === "undefined") return html
	// Dir of the HTML file (keep the trailing slash): strip the filename.
	const baseDir = htmlAssetUrl.replace(/[^/]*$/, "")
	const toAuthed = (ref: string): string => {
		const r = ref.trim()
		if (!isLocalRelative(r)) return ref
		return authedAssetUrl(resolveAgainstDir(baseDir, r))
	}

	const doc = new DOMParser().parseFromString(html, "text/html")

	for (const el of Array.from(doc.querySelectorAll("[src]"))) {
		const v = el.getAttribute("src")
		if (v) el.setAttribute("src", toAuthed(v))
	}
	for (const el of Array.from(doc.querySelectorAll("[srcset]"))) {
		const v = el.getAttribute("srcset")
		if (v) el.setAttribute("srcset", rewriteSrcset(v, toAuthed))
	}
	for (const el of Array.from(doc.querySelectorAll("style"))) {
		el.textContent = rewriteCssUrls(el.textContent ?? "", toAuthed)
	}
	for (const el of Array.from(doc.querySelectorAll("[style]"))) {
		const v = el.getAttribute("style")
		if (v) el.setAttribute("style", rewriteCssUrls(v, toAuthed))
	}

	return `<!doctype html>${doc.documentElement.outerHTML}`
}

/** No scheme, not protocol-relative, not root-absolute, not a fragment. */
function isLocalRelative(ref: string): boolean {
	return (
		ref.length > 0 &&
		!/^[a-z][a-z0-9+.-]*:/i.test(ref) &&
		!ref.startsWith("//") &&
		!ref.startsWith("/") &&
		!ref.startsWith("#")
	)
}

/** Resolve a relative ref against a URL directory (handles `.`/`..`). The
 *  result is still a bare tunnel path; the server clamps traversal. */
function resolveAgainstDir(baseDir: string, ref: string): string {
	const stack = baseDir.replace(/\/+$/, "").split("/")
	for (const seg of ref.split("/")) {
		if (seg === "" || seg === ".") continue
		if (seg === "..") {
			if (stack.length > 1) stack.pop()
			continue
		}
		stack.push(seg)
	}
	return stack.join("/")
}

/** Rewrite each URL in a `srcset` value, preserving descriptors (`1x`, `2x`,
 *  `640w`). */
function rewriteSrcset(
	value: string,
	toAuthed: (ref: string) => string,
): string {
	return value
		.split(",")
		.map((part) => {
			const trimmed = part.trim()
			if (!trimmed) return ""
			const sp = trimmed.indexOf(" ")
			if (sp < 0) return toAuthed(trimmed)
			return `${toAuthed(trimmed.slice(0, sp))}${trimmed.slice(sp)}`
		})
		.filter(Boolean)
		.join(", ")
}

/** Rewrite relative `url(...)` refs in a CSS string. */
function rewriteCssUrls(
	css: string,
	toAuthed: (ref: string) => string,
): string {
	return css.replace(
		/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
		(full, _q: string, ref: string) => {
			const r = ref.trim()
			if (!isLocalRelative(r)) return full
			return `url("${toAuthed(r)}")`
		},
	)
}
