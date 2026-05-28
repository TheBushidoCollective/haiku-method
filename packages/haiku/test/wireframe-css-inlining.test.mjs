// wireframe-css-inlining.test.mjs
//
// The SPA renders HTML artifacts (wireframes) in a srcDoc iframe, which
// has no artifact base URL — so a relative `<link rel="stylesheet"
// href="styles.css">` resolves against the SPA origin, not the artifact's
// dir on disk, and the wireframe renders as raw, unstyled HTML (reported
// 2026-05-20). parseOutputArtifacts inlines adjacent local stylesheets
// (and their relative @imports) into the body so it's self-contained and
// styles correctly in srcDoc. Remote / root-absolute / traversal links
// are left untouched.

import assert from "node:assert/strict"
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

async function withIntent(fn) {
	const root = mkdtempSync(join(tmpdir(), "haiku-wf-css-"))
	const intentDir = join(root, ".haiku", "intents", "demo")
	const artDir = join(intentDir, "stages", "design", "artifacts")
	mkdirSync(artDir, { recursive: true })
	try {
		await fn({ intentDir, artDir })
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

async function htmlArtifact(intentDir) {
	const { parseOutputArtifacts } = await import(`${SRC}parser.ts`)
	const arts = await parseOutputArtifacts(intentDir)
	return arts.find((a) => a.type === "html")
}

test("adjacent local stylesheet (and its @import) is inlined; remote/absolute links are left alone", async () => {
	await withIntent(async ({ intentDir, artDir }) => {
		writeFileSync(
			join(artDir, "wireframe.html"),
			[
				"<!doctype html><html><head>",
				'<link rel="stylesheet" href="styles.css">',
				'<link rel="stylesheet" href="https://cdn.example.com/tw.css">',
				'<link rel="stylesheet" href="/global.css">',
				'<link rel="icon" href="favicon.ico">',
				"</head><body><h1>Wireframe</h1></body></html>",
			].join("\n"),
		)
		writeFileSync(
			join(artDir, "styles.css"),
			'@import "tokens.css";\nh1 { color: rebeccapurple; }\n',
		)
		writeFileSync(join(artDir, "tokens.css"), ":root { --brand: #0aa; }\n")

		const html = await htmlArtifact(intentDir)
		assert.ok(html, "html artifact parsed")
		const body = html.content

		// Local stylesheet inlined as <style>, the <link> for it gone.
		assert.match(body, /<style data-haiku-inlined-from="styles\.css">/)
		assert.match(body, /color: rebeccapurple/)
		assert.doesNotMatch(body, /<link[^>]*href="styles\.css"/)
		// Its relative @import is inlined too (no @import left for it).
		assert.match(body, /--brand: #0aa/)
		assert.doesNotMatch(body, /@import\s+["']tokens\.css/)

		// Remote + root-absolute stylesheet links untouched.
		assert.match(body, /<link[^>]*href="https:\/\/cdn\.example\.com\/tw\.css"/)
		assert.match(body, /<link[^>]*href="\/global\.css"/)
		// Non-stylesheet link untouched.
		assert.match(body, /<link[^>]*rel="icon"[^>]*href="favicon\.ico"/)
	})
})

test("CSS url() refs are re-based onto the HTML dir (adjacent unchanged, @import'd subdir rewritten)", async () => {
	await withIntent(async ({ intentDir, artDir }) => {
		mkdirSync(join(artDir, "sub"), { recursive: true })
		writeFileSync(
			join(artDir, "wireframe.html"),
			'<html><head><link rel="stylesheet" href="styles.css"></head><body></body></html>',
		)
		writeFileSync(
			join(artDir, "styles.css"),
			'@import "sub/theme.css";\nbody { background: url(bg.png); }\n',
		)
		// A stylesheet one dir down: its url(tile.png) is authored relative to
		// sub/, so after inlining into the HTML it must become sub/tile.png.
		writeFileSync(
			join(artDir, "sub", "theme.css"),
			"h1 { background: url(tile.png); }\n",
		)
		const body = (await htmlArtifact(intentDir)).content
		// Adjacent stylesheet's ref stays at the HTML dir (quotes normalized).
		assert.match(body, /url\("bg\.png"\)/)
		// Subdir @import's ref is re-based onto the HTML dir.
		assert.match(body, /url\("sub\/tile\.png"\)/)
	})
})

test("path-traversal stylesheet href is NOT inlined (left as <link>, no escape read)", async () => {
	await withIntent(async ({ intentDir, artDir }) => {
		// A secret CSS OUTSIDE the intent dir.
		writeFileSync(
			join(intentDir, "..", "..", "secret.css"),
			"body{display:none}",
		)
		writeFileSync(
			join(artDir, "wireframe.html"),
			'<html><head><link rel="stylesheet" href="../../../secret.css"></head><body>x</body></html>',
		)
		const html = await htmlArtifact(intentDir)
		assert.ok(html)
		assert.doesNotMatch(
			html.content,
			/display:none/,
			"must not read CSS outside the intent dir",
		)
		assert.match(
			html.content,
			/<link[^>]*secret\.css/,
			"the escaping link is left untouched",
		)
	})
})

test("self-contained wireframe (no link) passes through unchanged", async () => {
	await withIntent(async ({ intentDir, artDir }) => {
		const original =
			"<html><head><style>h1{color:red}</style></head><body><h1>x</h1></body></html>"
		writeFileSync(join(artDir, "wireframe.html"), original)
		const html = await htmlArtifact(intentDir)
		assert.equal(html.content, original)
	})
})

// ── Serve-layer inlining (haiku_view / ViewPage) ──────────────────────────
//
// ViewPage renders HTML artifacts by fetching `/stage-artifacts/...` and
// srcDoc'ing the bytes (the raw URL is forced to octet-stream/attachment by
// FB-21, so an `<iframe src=…>` can't render it). The file-serve layer
// inlines adjacent stylesheets into the served HTML so it styles correctly
// once srcDoc'd — same fix as the parser path, applied at the serve sink so
// the runtime-verifier's browser sees a styled wireframe. Headers stay
// hardened (never a renderable text/html under the tunnel origin).

function mockReply() {
	const calls = { headers: {}, statusCode: 200, body: undefined }
	const reply = {
		header(k, v) {
			calls.headers[String(k).toLowerCase()] = v
			return reply
		},
		status(n) {
			calls.statusCode = n
			return reply
		},
		send(b) {
			calls.body = b
			return reply
		},
	}
	return { reply, calls }
}

test("serveArtifact inlines adjacent CSS into served HTML, keeps hardened headers", async () => {
	await withIntent(async ({ intentDir, artDir }) => {
		writeFileSync(
			join(artDir, "wireframe.html"),
			'<html><head><link rel="stylesheet" href="styles.css"></head><body><h1>x</h1></body></html>',
		)
		writeFileSync(join(artDir, "styles.css"), "h1 { color: rebeccapurple; }\n")
		const { serveArtifact } = await import(`${SRC}http/path-safety.ts`)
		const { reply, calls } = mockReply()
		// Real callers pass `safe.path` (already realpath'd); mirror that.
		await serveArtifact(
			reply,
			realpathSync(join(artDir, "wireframe.html")),
			intentDir,
		)

		assert.equal(calls.statusCode, 200)
		// Inlined + the <link> for it gone.
		assert.match(calls.body, /<style data-haiku-inlined-from="styles\.css">/)
		assert.match(calls.body, /color: rebeccapurple/)
		assert.doesNotMatch(calls.body, /<link[^>]*href="styles\.css"/)
		// Never a renderable content-type under the tunnel origin.
		assert.equal(calls.headers["content-type"], "application/octet-stream")
		assert.equal(calls.headers["content-disposition"], "attachment")
		assert.equal(calls.headers["x-content-type-options"], "nosniff")
	})
})

test("serveArtifact does NOT inline a stylesheet escaping the clamp root", async () => {
	await withIntent(async ({ intentDir, artDir }) => {
		writeFileSync(
			join(intentDir, "..", "..", "secret.css"),
			"body{display:none}",
		)
		writeFileSync(
			join(artDir, "wireframe.html"),
			'<html><head><link rel="stylesheet" href="../../../secret.css"></head><body>x</body></html>',
		)
		const { serveArtifact } = await import(`${SRC}http/path-safety.ts`)
		const { reply, calls } = mockReply()
		await serveArtifact(
			reply,
			realpathSync(join(artDir, "wireframe.html")),
			intentDir,
		)
		assert.doesNotMatch(
			calls.body,
			/display:none/,
			"must not read CSS outside the clamp root",
		)
		assert.match(
			calls.body,
			/<link[^>]*secret\.css/,
			"escaping link left untouched",
		)
	})
})

test("serveArtifact delegates non-HTML to serveFile (image stays a typed inline type)", async () => {
	await withIntent(async ({ artDir, intentDir }) => {
		// 1x1 transparent PNG.
		const png = Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
			"base64",
		)
		writeFileSync(join(artDir, "shot.png"), png)
		const { serveArtifact } = await import(`${SRC}http/path-safety.ts`)
		const { reply, calls } = mockReply()
		await serveArtifact(
			reply,
			realpathSync(join(artDir, "shot.png")),
			intentDir,
		)
		assert.equal(
			calls.headers["content-type"],
			"image/png",
			"image served as a typed inline type, not octet-stream",
		)
		assert.ok(Buffer.isBuffer(calls.body), "binary body sent as a Buffer")
	})
})
