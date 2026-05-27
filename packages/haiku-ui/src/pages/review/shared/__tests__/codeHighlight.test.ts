import { describe, expect, it } from "vitest"
import { highlightCodeToHtml } from "../codeHighlight"

describe("highlightCodeToHtml", () => {
	it("escapes embedded JSX/HTML instead of letting it render (the empty-box regression)", () => {
		// The bug: code typed as markdown ran through remark, which parsed
		// `<div>` as inline HTML and DOMPurify stripped it → empty box. Here
		// the angle brackets must survive as escaped text.
		const html = highlightCodeToHtml(
			'const x = () => <div className="a">{value}</div>',
			"tsx",
		)
		// Angle brackets survive as entities (highlight.js may wrap the tag
		// name in a token span, so `&lt;` and `div` aren't necessarily
		// adjacent — assert the entities + the escaped close tag).
		expect(html).toContain("&lt;")
		expect(html).toContain("&gt;")
		expect(html).toContain("&lt;/")
		// The literal element must NOT appear as a real tag the browser would
		// render (and thereby hide) — only hljs's own <span>/<pre>/<code>.
		expect(html).not.toContain('<div className="a">')
		expect(html).not.toContain("<div ")
	})

	it('wraps output in a <pre class="hljs-block"><code class="hljs"> shell', () => {
		const html = highlightCodeToHtml("print('hi')", "python")
		expect(html).toMatch(/<pre class="hljs-block"><code class="hljs">/)
		expect(html).toContain("</code></pre>")
	})

	it("emits hljs token spans for a known grammar", () => {
		const html = highlightCodeToHtml(
			"function add(a, b) { return a + b }",
			"javascript",
		)
		expect(html).toMatch(/class="hljs-/)
	})

	it("falls back to plain escaped text when the language is unknown", () => {
		const html = highlightCodeToHtml("a < b && c > d", "no-such-lang")
		// Still escaped + wrapped — the ASCII floor, never an empty box.
		expect(html).toContain("a &lt; b &amp;&amp; c &gt; d")
		expect(html).toMatch(/<pre class="hljs-block">/)
	})

	it("falls back to plain escaped text when no language is given", () => {
		const html = highlightCodeToHtml("plain <text> here")
		expect(html).toContain("plain &lt;text&gt; here")
	})

	it("does not crash on empty input", () => {
		expect(() => highlightCodeToHtml("", "typescript")).not.toThrow()
	})
})
