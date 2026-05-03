// state/sanitize-feedback.ts — V-10 server-side feedback body sanitizer.
//
// Lives under `state/` (not `http/`) because this is a pure-string
// transformer with no Fastify / HTTP coupling — it is consumed by the
// MCP tool surface (`state-tools.ts`'s `haiku_classify_drift` and
// feedback-write paths) AND the SPA backend (`http/feedback-api.ts`
// POST/PUT routes). Per the §4.3 dependency-direction rule (`http/`
// is a downstream consumer; nothing else may import back into `http/`),
// this primitive belongs here, not in `http/`.
//
// Strips dangerous HTML/markdown constructs from any feedback body that
// flows from an external input (agent path via haiku_classify_drift,
// SPA path via /api/feedback/:intent/:stage POST and PUT) before it
// hits disk.
//
// Why server-side AND not just client-side?
//
//   The SPA renderer applies its own input-side allowlist when rendering
//   feedback markdown — so client-side, an `<script>` tag in a body
//   never gets mounted as an executable element. Server-side
//   sanitization is defence in depth: it ensures the on-disk artefact
//   itself is safe, so:
//
//     • A future renderer bug (raw-HTML pass-through) cannot resurrect
//       a payload an attacker planted weeks ago.
//     • An out-of-band consumer of the feedback files (CLI tool,
//       export script, third-party integration) inherits the same
//       safety floor without having to re-implement allowlists.
//     • Audit trails (write-audit.jsonl) record sanitized content,
//       so forensic investigators see what actually persisted.
//
// What gets stripped:
//
//   • `<script>` ... `</script>` blocks (entire content removed).
//   • `<iframe>` ... `</iframe>` blocks.
//   • `<object>` ... `</object>` blocks.
//   • `<embed>` self-closing tags.
//   • `<style>` ... `</style>` blocks (CSS expression injection vector).
//   • `<form>` ... `</form>` blocks (planted forms can be auto-submitted
//     by other XSS payloads in the same origin).
//   • Standalone `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`,
//     `<form>` tags with no closing tag (broken markup attackers use to
//     exploit lenient parsers).
//   • Inline event-handler attributes: `on*=`, `formaction=`, `srcdoc=`,
//     `xlink:href=` on any tag.
//   • Dangerous URL schemes in `href=` and `src=`: `javascript:`,
//     `data:text/html`, `vbscript:` — replaced with `#`.
//   • Markdown autolinks of the form `[text](javascript:…)` —
//     URL portion replaced with `#`.
//
// What is preserved (positive case):
//
//   • All standard markdown: headings, bold, italic, lists, code blocks,
//     blockquotes, tables.
//   • `[text](https://...)` and `[text](http://...)` and `[text](mailto:...)`.
//   • Image references with `data:image/...` (base64 attachments) and
//     intent-scope paths like `/api/feedback-attachment/...`.
//   • Plain text including angle brackets that aren't valid HTML
//     (e.g. `<3` for love, `a < b` in math) — only recognized HTML-tag
//     openings are touched.
//
// This is NOT a full HTML parser; markdown-injected XSS surfaces are
// few and well-known. A purpose-built regex sanitizer is more robust
// than wiring in a dependency like sanitize-html (which itself has
// had bypasses). The sanitizer is deterministic, fast, and trivially
// auditable — every transformation is one line.

const DANGEROUS_BLOCK_TAGS = ["script", "iframe", "object", "style", "form"]
const DANGEROUS_VOID_TAGS = ["embed"]

const DANGEROUS_URL_SCHEMES = /^(?:javascript|vbscript|data:text\/html)/i

/** Strip `<tag>...</tag>` blocks AND any standalone opening or closing
 *  occurrences of the same tag name (broken-markup defence). Case-
 *  insensitive. The block-strip is non-greedy so multiple instances on
 *  the same line don't get coalesced. */
function stripBlockTag(input: string, tagName: string): string {
	const tag = tagName.toLowerCase()
	// Non-greedy match for `<tag …>…</tag>` across multiple lines.
	const blockRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi")
	let out = input.replace(blockRe, "")
	// Standalone openings (no closer found). The block-strip leaves
	// these behind by design (it only matched complete pairs). Strip
	// them here.
	const openRe = new RegExp(`<${tag}\\b[^>]*>`, "gi")
	out = out.replace(openRe, "")
	// And any orphaned closers.
	const closeRe = new RegExp(`<\\/${tag}\\s*>`, "gi")
	out = out.replace(closeRe, "")
	return out
}

/** Strip self-closing void-element tags like `<embed src="…" />`. */
function stripVoidTag(input: string, tagName: string): string {
	const tag = tagName.toLowerCase()
	const re = new RegExp(`<${tag}\\b[^>]*/?>`, "gi")
	return input.replace(re, "")
}

/** Strip `on*=` event-handler attributes anywhere in the body. Case-
 *  insensitive. Handles single-quoted, double-quoted, and unquoted
 *  attribute values. */
function stripEventHandlers(input: string): string {
	// `on<word>="..."` or `on<word>='...'` or `on<word>=value`
	return input.replace(
		/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
		"",
	)
}

/** Strip dangerous attributes other than `on*=`: `formaction`, `srcdoc`,
 *  `xlink:href`. */
function stripDangerousAttrs(input: string): string {
	return input.replace(
		/\s+(?:formaction|srcdoc|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
		"",
	)
}

/** Replace dangerous URL schemes inside `href=` and `src=` attributes
 *  with `#`. Preserves the attribute name and surrounding markup; only
 *  the URL value is rewritten. */
function neutralizeAttrUrlSchemes(input: string): string {
	return input.replace(
		/\b(href|src)\s*=\s*(["']?)([^"'\s>]+)/gi,
		(match, attr, quote, url) => {
			if (DANGEROUS_URL_SCHEMES.test(url.trim())) {
				return `${attr}=${quote || '"'}#${quote || '"'}`
			}
			return match
		},
	)
}

/** Replace dangerous URL schemes inside markdown link/image syntax:
 *  `[text](javascript:…)` → `[text](#)`,
 *  `![alt](javascript:…)` → `![alt](#)`. */
function neutralizeMarkdownUrlSchemes(input: string): string {
	return input.replace(
		/(!?\[[^\]]*\])\(([^)]+)\)/g,
		(match, label, url) => {
			if (DANGEROUS_URL_SCHEMES.test(url.trim())) {
				return `${label}(#)`
			}
			return match
		},
	)
}

/**
 * Sanitize a feedback body. Returns the safe-for-disk version. The
 * input string is never modified in place; the returned string is the
 * authoritative version to persist.
 *
 * Calling this is idempotent — sanitizing an already-sanitized string
 * is a no-op (the sanitizer only removes patterns; it never introduces
 * new ones).
 *
 * Empty / null / non-string inputs are coerced to "" (caller-side
 * validation should have caught these earlier; defensive default).
 */
export function sanitizeFeedbackBody(body: unknown): string {
	if (typeof body !== "string") return ""

	let out = body

	// 1. Strip dangerous block tags (and their content).
	for (const tag of DANGEROUS_BLOCK_TAGS) {
		out = stripBlockTag(out, tag)
	}

	// 2. Strip dangerous void tags.
	for (const tag of DANGEROUS_VOID_TAGS) {
		out = stripVoidTag(out, tag)
	}

	// 3. Strip inline event handlers and dangerous attributes from any
	//    remaining tags (e.g. `<img onerror=…>`).
	out = stripEventHandlers(out)
	out = stripDangerousAttrs(out)

	// 4. Neutralize dangerous URL schemes in href/src attributes and
	//    markdown links.
	out = neutralizeAttrUrlSchemes(out)
	out = neutralizeMarkdownUrlSchemes(out)

	return out
}
