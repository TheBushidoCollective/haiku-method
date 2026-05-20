import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	__resetAuthForTesting,
	__setAuthTokenForTesting,
} from "../../../../api/auth"
import { resolveEmbeddedAssetUrls } from "../inline-asset-urls"

const JWT = "aaa.bbb.ccc"
const BASE = "/stage-artifacts/sess-1/stages/design/artifacts/index.html"

describe("resolveEmbeddedAssetUrls", () => {
	beforeEach(() => {
		__setAuthTokenForTesting(JWT)
	})
	afterEach(() => {
		__resetAuthForTesting()
	})

	it("rewrites a relative <img src> to an authed tunnel URL resolved against the HTML dir", () => {
		const out = resolveEmbeddedAssetUrls(
			'<html><body><img src="logo.png"></body></html>',
			BASE,
		)
		expect(out).toContain(
			`src="/stage-artifacts/sess-1/stages/design/artifacts/logo.png?t=${JWT}"`,
		)
	})

	it("resolves ../ refs against the HTML dir before authing", () => {
		const out = resolveEmbeddedAssetUrls(
			'<html><body><img src="../shared/bg.png"></body></html>',
			BASE,
		)
		expect(out).toContain(
			`src="/stage-artifacts/sess-1/stages/design/shared/bg.png?t=${JWT}"`,
		)
	})

	it("rewrites CSS url(...) inside <style> and inline style=", () => {
		const out = resolveEmbeddedAssetUrls(
			"<html><head><style>body{background:url(hero.jpg)}</style></head><body><div style=\"background: url('icon.svg')\"></div></body></html>",
			BASE,
		)
		// <style> element text: quotes survive verbatim.
		expect(out).toContain(
			`url("/stage-artifacts/sess-1/stages/design/artifacts/hero.jpg?t=${JWT}")`,
		)
		// Inline style= attribute: the serializer entity-escapes the quotes
		// (browser un-escapes at parse time), so assert the resolved path.
		expect(out).toContain(
			`/stage-artifacts/sess-1/stages/design/artifacts/icon.svg?t=${JWT}`,
		)
	})

	it("rewrites each URL in a srcset, preserving descriptors", () => {
		const out = resolveEmbeddedAssetUrls(
			'<html><body><img srcset="a.png 1x, b.png 2x"></body></html>',
			BASE,
		)
		expect(out).toContain(
			`/stage-artifacts/sess-1/stages/design/artifacts/a.png?t=${JWT} 1x`,
		)
		expect(out).toContain(
			`/stage-artifacts/sess-1/stages/design/artifacts/b.png?t=${JWT} 2x`,
		)
	})

	it("leaves remote, root-absolute, data:, and # refs untouched", () => {
		const html = [
			'<img src="https://cdn.example.com/x.png">',
			'<img src="/global/y.png">',
			'<img src="data:image/png;base64,AAAA">',
			'<use href="#icon">',
		].join("")
		const out = resolveEmbeddedAssetUrls(
			`<html><body>${html}</body></html>`,
			BASE,
		)
		expect(out).toContain('src="https://cdn.example.com/x.png"')
		expect(out).toContain('src="/global/y.png"')
		expect(out).toContain('src="data:image/png;base64,AAAA"')
	})

	it("does NOT rewrite <a href> links", () => {
		const out = resolveEmbeddedAssetUrls(
			'<html><body><a href="other.html">next</a></body></html>',
			BASE,
		)
		expect(out).toContain('href="other.html"')
		expect(out).not.toContain(
			"/stage-artifacts/sess-1/stages/design/artifacts/other.html",
		)
	})

	it("does not mangle a 'src=' string literal inside <script> (DOM-based)", () => {
		const out = resolveEmbeddedAssetUrls(
			'<html><body><script>const s = "src=\\"trap.png\\""</script><img src="real.png"></body></html>',
			BASE,
		)
		// The script literal is untouched; only the real <img src> is rewritten.
		expect(out).toContain('src=\\"trap.png\\"')
		expect(out).toContain(
			`src="/stage-artifacts/sess-1/stages/design/artifacts/real.png?t=${JWT}"`,
		)
	})

	it("returns the input unchanged when there is no base URL", () => {
		const html = '<html><body><img src="logo.png"></body></html>'
		expect(resolveEmbeddedAssetUrls(html, undefined)).toBe(html)
		expect(resolveEmbeddedAssetUrls(html, "")).toBe(html)
	})
})
