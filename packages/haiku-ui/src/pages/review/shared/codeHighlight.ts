/**
 * codeHighlight — turn a code artifact's source into sanitized, syntax-
 * highlighted HTML for the review surface.
 *
 * Code outputs (`.tsx`, `.py`, `.yaml`, …) used to be typed `markdown` and
 * fed through remark, which parsed embedded JSX/HTML as inline HTML and let
 * DOMPurify strip it — the source rendered as an empty box. Code now arrives
 * as `type: "code"` (+ a highlight.js `language` id) and renders here: the
 * source is escaped + token-wrapped by highlight.js, so `<div>` / `{expr}`
 * show as literal text, and the result is annotatable (the inline-comment
 * layer anchors to the rendered text the same way it does for markdown).
 *
 * We import highlight.js's curated `common` build rather than the full one:
 * it covers the languages in `EXT_TO_HLJS_LANG` (parser.ts) while keeping the
 * single-blob SPA bundle lean. A language id the common build doesn't know
 * (or an absent id, for a text file with no grammar) falls through to a plain
 * escaped `<pre>` — the "render as ASCII" floor.
 */

import DOMPurify from "dompurify"
import hljs from "highlight.js/lib/common"

let aliasesRegistered = false
function ensureAliases(): void {
	if (aliasesRegistered) return
	aliasesRegistered = true
	// highlight.js has no dedicated tsx/jsx grammars — the TS/JS grammars
	// parse them well enough (JSX tags render as escaped text regardless,
	// which is the whole point). Register the aliases the parser emits.
	try {
		hljs.registerAliases(["tsx"], { languageName: "typescript" })
		hljs.registerAliases(["jsx"], { languageName: "javascript" })
	} catch {
		/* already registered (hot reload) — ignore */
	}
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Render code as a sanitized `<pre class="hljs-block"><code class="hljs">…`
 * HTML string. When `language` is a grammar the common build knows, the body
 * is highlight.js-tokenized; otherwise it's plain-escaped. Always escaped,
 * always DOMPurify-sanitized — safe to inject as trusted HTML or to hand to
 * the inline-comment renderer as `htmlContent`.
 */
export function highlightCodeToHtml(code: string, language?: string): string {
	ensureAliases()
	const lang = language && hljs.getLanguage(language) ? language : null
	let inner: string
	if (lang) {
		try {
			inner = hljs.highlight(code, {
				language: lang,
				ignoreIllegals: true,
			}).value
		} catch {
			inner = escapeHtml(code)
		}
	} else {
		inner = escapeHtml(code)
	}
	const html = `<pre class="hljs-block"><code class="hljs">${inner}</code></pre>`
	// highlight.js output is entity-escaped; DOMPurify keeps the <span class>
	// token wrappers (class is allowed by default) and strips anything else.
	return DOMPurify.sanitize(html)
}
