// http/file-serve.ts — File-serving routes (path-traversal hardened).
//
// All routes are session-scoped: each one resolves the session, the
// session's intent_dir or per-session image base, then delegates to
// path-safety helpers (rejectUnsafePathParam / resolvePathSafe /
// serveFile / serveUnderRoot). No auth bypass paths; every request
// must clear requireTunnelAuth.
//
// Routes:
//   GET /files/:sessionId/*            → intent dir + sibling knowledge dir
//   GET /mockups/:sessionId/*          → <intent>/mockups/
//   GET /wireframe/:sessionId/*        → review-session intent dir
//   GET /stage-artifacts/:sessionId/*  → review-session intent dir
//   GET /question-image/:sessionId/:index → question-session image by index

import { realpath } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import type { FastifyInstance } from "fastify"
import { getSession } from "../sessions.js"
import { requireTunnelAuth } from "./auth.js"
import {
	rejectUnsafePathParam,
	resolvePathSafe,
	serveFile,
	serveUnderRoot,
} from "./path-safety.js"

export function registerFileServeRoutes(instance: FastifyInstance): void {
	instance.get<{ Params: { sessionId: string; "*": string } }>(
		"/files/:sessionId/*",
		async (req, reply) => {
			const { sessionId } = req.params
			const filePath = (req.params as Record<string, string>)["*"]
			if (!requireTunnelAuth(req, reply, sessionId)) return
			if (rejectUnsafePathParam(reply, sessionId, filePath)) return
			const session = getSession(sessionId)
			if (!session) {
				reply.status(404).send("Session not found")
				return
			}
			const intentDirPath =
				session.session_type === "review" ? session.intent_dir : null
			const haikuKnowledgeDir = intentDirPath
				? resolve(dirname(dirname(intentDirPath)), "knowledge")
				: null
			const allowedBases = [intentDirPath, haikuKnowledgeDir].filter(
				(d): d is string => d !== null,
			)
			if (allowedBases.length === 0) {
				reply.status(404).send("Not found")
				return
			}
			let escaped = false
			for (const baseDir of allowedBases) {
				const safe = await resolvePathSafe(baseDir, filePath)
				if (!safe.ok) {
					escaped = true
					continue
				}
				return serveFile(reply, safe.path)
			}
			if (escaped) {
				reply.status(403).send({ error: "forbidden_path_traversal" })
				return
			}
			reply.status(404).send("Not found")
		},
	)

	instance.get<{ Params: { sessionId: string; "*": string } }>(
		"/mockups/:sessionId/*",
		async (req, reply) => {
			const { sessionId } = req.params
			const filePath = (req.params as Record<string, string>)["*"]
			if (!requireTunnelAuth(req, reply, sessionId)) return
			if (rejectUnsafePathParam(reply, sessionId, filePath)) return
			const session = getSession(sessionId)
			if (!session || session.session_type !== "review") {
				reply.status(404).send("Session not found")
				return
			}
			return serveUnderRoot(
				reply,
				join(session.intent_dir, "mockups"),
				filePath,
			)
		},
	)

	instance.get<{ Params: { sessionId: string; "*": string } }>(
		"/wireframe/:sessionId/*",
		async (req, reply) => {
			const { sessionId } = req.params
			const filePath = (req.params as Record<string, string>)["*"]
			if (!requireTunnelAuth(req, reply, sessionId)) return
			if (rejectUnsafePathParam(reply, sessionId, filePath)) return
			const session = getSession(sessionId)
			if (!session || session.session_type !== "review") {
				reply.status(404).send("Session not found")
				return
			}
			return serveUnderRoot(reply, session.intent_dir, filePath)
		},
	)

	instance.get<{ Params: { sessionId: string; "*": string } }>(
		"/stage-artifacts/:sessionId/*",
		async (req, reply) => {
			const { sessionId } = req.params
			const filePath = (req.params as Record<string, string>)["*"]
			if (!requireTunnelAuth(req, reply, sessionId)) return
			if (rejectUnsafePathParam(reply, sessionId, filePath)) return
			const session = getSession(sessionId)
			// Review AND view sessions are both rooted at intent_dir and
			// both expose stage artifacts; `haiku_view` sessions piggyback
			// on this route so the SPA's artifact-browser can serve files
			// through the same path-safety + tunnel-auth chain the review
			// pane already uses.
			if (
				!session ||
				(session.session_type !== "review" && session.session_type !== "view")
			) {
				reply.status(404).send("Session not found")
				return
			}
			return serveUnderRoot(reply, session.intent_dir, filePath)
		},
	)

	instance.get<{ Params: { sessionId: string; index: string } }>(
		"/question-image/:sessionId/:index",
		async (req, reply) => {
			const { sessionId } = req.params
			const index = Number.parseInt(req.params.index, 10)
			if (!requireTunnelAuth(req, reply, sessionId)) return
			const session = getSession(sessionId)
			if (!session || session.session_type !== "question") {
				reply.status(404).send("Session not found")
				return
			}
			const imagePaths = session.imagePaths ?? []
			if (index < 0 || index >= imagePaths.length) {
				reply.status(404).send("Image index out of range")
				return
			}
			const imagePath = imagePaths[index]
			if (!imagePath.startsWith("/")) {
				reply.status(403).send("Forbidden")
				return
			}
			const allowedBaseDir = session.imageBaseDirs?.[index]
			if (allowedBaseDir) {
				try {
					const realResolved = await realpath(imagePath).catch(() => null)
					const realBase = await realpath(allowedBaseDir).catch(() =>
						resolve(allowedBaseDir),
					)
					if (
						!realResolved ||
						(!realResolved.startsWith(`${realBase}/`) &&
							realResolved !== realBase)
					) {
						reply.status(403).send("Forbidden")
						return
					}
				} catch {
					reply.status(403).send("Forbidden")
					return
				}
			}
			return serveFile(reply, imagePath)
		},
	)
}
