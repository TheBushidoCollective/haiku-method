// http/path-safety.ts — Filesystem path-traversal defence + safe file
// serving. Used by every asset-serve route (mockups, wireframes,
// stage-artifacts, session files, feedback attachments) so a malicious
// `path` parameter can't escape the session's file root.
//
// SVG defence-in-depth: the feedback-attachment schema rejects
// `image/svg+xml` on POST, but legacy intent dirs may still contain
// `.svg` files. Inline SVG renders execute embedded `<script>` under
// the serving origin — in tunnel mode that's the reviewer's privileged
// tab. Force-download .svg responses so the browser can't render them.

import { readFile, realpath } from "node:fs/promises"
import { extname, resolve } from "node:path"
import type { FastifyReply } from "fastify"
import { FileServeParamsSchema } from "haiku-api"

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".md": "text/markdown; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".pdf": "application/pdf",
}

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
		// SVG defence-in-depth: force download AND strip the MIME type
		// claim. Some browser extensions / proxies key on Content-Type
		// over Content-Disposition when deciding whether to render
		// inline; serving as application/octet-stream removes that
		// ambiguity entirely.
		if (ext === ".svg") {
			reply.header("Content-Type", "application/octet-stream")
			reply.header("Content-Disposition", "attachment")
		} else {
			const contentType = MIME_TYPES[ext] ?? "application/octet-stream"
			reply.header("Content-Type", contentType)
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
