/**
 * File-serving endpoints — consolidated `/files/:sessionId/*path`, plus the
 * legacy-alias endpoints that share a path-parameter shape:
 *   - /mockups/:sessionId/:path
 *   - /wireframe/:sessionId/:path
 *   - /stage-artifacts/:sessionId/:path
 *   - /question-image/:sessionId/:index
 *
 * These responses are raw byte streams (images, pdfs, html), so only the
 * request parameter shape is schematized here.
 */

import { z } from "zod"

export const FileServeParamsSchema = z
	.object({
		sessionId: z
			.string()
			.min(1)
			.describe("Session ID (UUID issued by sessions.createSession)"),
		path: z
			.string()
			.min(1)
			.describe("Relative path under the session's serving root"),
	})
	.describe("Path parameters for /files/:sessionId/*path and aliases")
export type FileServeParams = z.infer<typeof FileServeParamsSchema>

export const QuestionImageParamsSchema = z
	.object({
		sessionId: z.string().min(1),
		index: z
			.number()
			.int()
			.nonnegative()
			.describe("Zero-based image index within the question session"),
	})
	.describe("Path parameters for /question-image/:sessionId/:index")
export type QuestionImageParams = z.infer<typeof QuestionImageParamsSchema>
