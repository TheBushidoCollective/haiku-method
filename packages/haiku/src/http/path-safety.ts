// http/path-safety.ts — Filesystem path-traversal defence + safe file
// serving. Used by every asset-serve route (mockups, wireframes,
// stage-artifacts, session files, feedback attachments) so a malicious
// `path` parameter can't escape the session's file root.
//
// Read-side MIME defence (FB-21 — defence-in-depth against OOB drops):
// `serveFile` operates an *inverted* MIME map. Only the explicit
// `SAFE_INLINE_MIME_TYPES` entries (images, PDF, plain text, markdown,
// JSON) render inline with a typed Content-Type. Everything else is
// forced to `application/octet-stream` + `Content-Disposition:
// attachment` and stamped with `X-Content-Type-Options: nosniff`. This
// closes the OOB-filesystem-drop XSS path that the entire
// `out-of-band-human-file-modifications` intent exists to defend
// against: an attacker who lands `poison.html` in the tracked surface
// via filesystem write (no upload boundary involved) cannot get
// `serveFile` to return it as `text/html` for the reviewer to execute
// under the tunnel origin. `BLOCKED_INLINE_EXTENSIONS` is an explicit
// belt-and-braces blocklist mirroring upload-routes.ts's
// `BLOCKED_EXTENSIONS` so an accidental safe-list addition (e.g. `.html`)
// still cannot serve inline.
//
// V-04 (Symlink TOCTOU defence): the `safeMkdirAndRename` /
// `cleanupTempFile` helpers used to live here; they were moved to
// `state/safe-write.ts` (see §4.3 — `http/` is a downstream consumer,
// nothing imports back into `http/`). Upload routes import them from
// the new location.

import { readFile, realpath } from "node:fs/promises"
import { extname, resolve } from "node:path"
import type { FastifyReply } from "fastify"
import { FileServeParamsSchema } from "haiku-api"

/**
 * FB-21 (defence-in-depth — OOB filesystem drops):
 *
 * Upload routes already block `.html`, `.htm`, `.svg`, `.xml`, `.xhtml`,
 * `.mhtml`, `.js`, `.mjs`, `.cjs`, `.css`, `.htc`, `.hta`, `.htaccess` —
 * but the entire raison d'être of the `out-of-band-human-file-modifications`
 * intent is detecting files that land in the tracked surface via
 * filesystem writes that bypass the upload boundary. For OOB drops there
 * is no upload-time MIME/extension check; the only line of defence the
 * SPA-facing `serveFile` can mount is at the read sink.
 *
 * Inversion: `SAFE_INLINE_MIME_TYPES` enumerates the only extensions
 * that render inline with a typed `Content-Type` (images, PDF, plain
 * text, JSON, markdown). Every other extension — including any future
 * browser-renderable type we forget to enumerate — falls through to
 * `application/octet-stream` + `Content-Disposition: attachment`. This
 * mirrors the upload `BLOCKED_EXTENSIONS` allowlist semantics on the
 * read side: only known-safe inline types are served inline; everything
 * else is forced to download.
 *
 * Markdown is served as `text/markdown` rather than `text/html` (the SPA
 * does its own client-side rendering of markdown bodies through the
 * sanitizer). Plain text is served as `text/plain; charset=utf-8`. JSON
 * stays `application/json` because the drift-gate / classification UX
 * fetches manifests as JSON.
 *
 * `application/pdf` renders inline by browsers but cannot host XSS in the
 * tunnel origin (PDFs render in a sandboxed plugin context); kept inline.
 *
 * Markdown rendering safety: the SPA fetches markdown bodies via
 * `serveFile` but never injects them into the DOM as HTML — they go
 * through the same client-side sanitizer pipeline used for feedback
 * bodies (`sanitizeFeedbackBody`). So `text/markdown` Content-Type is
 * advisory only; the byte content cannot execute.
 */
const SAFE_INLINE_MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".pdf": "application/pdf",
	".txt": "text/plain; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".json": "application/json; charset=utf-8",
}

/**
 * Extensions that MUST always be served as `application/octet-stream` +
 * `Content-Disposition: attachment`, even though the inverted
 * `SAFE_INLINE_MIME_TYPES` map already excludes them. This is a
 * defence-in-depth assertion: an attacker who introduces a new safe-list
 * entry by mistake (e.g. adds `.html → text/html`) will still be blocked
 * for these extensions because the explicit-block check fires first.
 *
 * Mirrors `BLOCKED_EXTENSIONS` in `upload-routes.ts` so the upload-side
 * and serve-side blocklists stay in lockstep — anything new that gets
 * added to the upload blocklist (e.g. `.wasm`, future template formats)
 * MUST also be added here. The duplication is intentional: a single
 * shared constant would couple the http/upload-routes module to the
 * pure-fs path-safety module, and the lists serve different boundary
 * checks (upload rejects with 415, serveFile downgrades to attachment).
 */
const BLOCKED_INLINE_EXTENSIONS: ReadonlySet<string> = new Set([
	".html",
	".htm",
	".svg",
	".xml",
	".xhtml",
	".mhtml",
	".js",
	".mjs",
	".cjs",
	".css",
	".htc",
	".hta",
	".htaccess",
])

/** Resolve `requested` against `root` and verify the resolved path
 *  stays inside the root after symlink resolution. Returns the real
 *  filesystem path on success, `{ ok: false }` on any traversal or
 *  realpath failure. */
export async function resolvePathSafe(
	root: string,
	requested: string,
): Promise<{ ok: true; path: string } | { ok: false }> {
	const resolvedRoot = resolve(root)
	const resolved = resolve(resolvedRoot, requested)
	if (!resolved.startsWith(`${resolvedRoot}/`) && resolved !== resolvedRoot) {
		return { ok: false }
	}
	try {
		const realResolved = await realpath(resolved).catch(() => null)
		const realBase = await realpath(resolvedRoot).catch(() => resolvedRoot)
		if (
			!realResolved ||
			(!realResolved.startsWith(`${realBase}/`) && realResolved !== realBase)
		) {
			return { ok: false }
		}
		return { ok: true, path: realResolved }
	} catch {
		return { ok: false }
	}
}

/**
 * Schema-level path refinement. Rejects adversarial `..`, `%2e%2e`,
 * null-byte, and backslash fixtures before we even reach the
 * filesystem. Returns true (and sends the 403) on rejection, false
 * when the path passes the schema check.
 */
export function rejectUnsafePathParam(
	reply: FastifyReply,
	sessionId: string,
	filePath: string,
): boolean {
	const parsed = FileServeParamsSchema.safeParse({ sessionId, path: filePath })
	if (parsed.success) return false
	reply.status(403).send({ error: "forbidden_path_traversal" })
	return true
}

export async function serveFile(
	reply: FastifyReply,
	realPath: string,
): Promise<void> {
	try {
		const data = await readFile(realPath)
		const ext = extname(realPath).toLowerCase()
		// FB-21: inverted MIME map. Only known-safe extensions render
		// inline with a typed Content-Type; everything else (including
		// any extension on `BLOCKED_INLINE_EXTENSIONS`, and any future
		// browser-renderable type we forget to enumerate) is forced to
		// `application/octet-stream` + `Content-Disposition: attachment`
		// so it cannot execute under the tunnel origin via OOB-drop.
		//
		// `X-Content-Type-Options: nosniff` is stamped unconditionally so
		// browser MIME-sniffing cannot upgrade an octet-stream payload
		// back to a renderable type based on byte heuristics.
		const inline = SAFE_INLINE_MIME_TYPES[ext]
		const blocked = BLOCKED_INLINE_EXTENSIONS.has(ext)
		reply.header("X-Content-Type-Options", "nosniff")
		if (inline && !blocked) {
			reply.header("Content-Type", inline)
		} else {
			reply.header("Content-Type", "application/octet-stream")
			reply.header("Content-Disposition", "attachment")
		}
		reply.send(data)
	} catch {
		reply.status(404).send("Not found")
	}
}

export async function serveUnderRoot(
	reply: FastifyReply,
	rootDir: string,
	filePath: string,
): Promise<void> {
	const safe = await resolvePathSafe(rootDir, filePath)
	if (!safe.ok) {
		reply.status(403).send({ error: "forbidden_path_traversal" })
		return
	}
	return serveFile(reply, safe.path)
}
