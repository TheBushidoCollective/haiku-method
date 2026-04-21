/**
 * DOM parity scaffold.
 *
 * Unit-03 spec calls for a Playwright test that boots a test MCP against
 * committed fixtures and snapshots the rendered DOM tree for each session
 * page. Capturing a faithful pre-move baseline requires infrastructure that
 * is out of scope for a relocation unit (see unit-03-extract-haiku-ui-notes.md).
 *
 * What this scaffold DOES provide, as a meaningful no-regression check:
 *   - Validates each committed fixture (review, question, design_direction)
 *     against the `SessionPayload` discriminated-union schema from
 *     haiku-api. If the SPA can trust these shapes, it can render them.
 *   - Serves as the anchor file for later DOM-snapshot capture — future
 *     commits extend this to actually render and snapshot.
 *
 * Run: `npx vitest run tests/parity.spec.ts`  (runs under the same
 * vitest harness as the rAF coalesce test).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { SessionPayloadSchema } from "haiku-api"

const FIXTURES = [
	"review-session.json",
	"question-session.json",
	"direction-session.json",
] as const

describe("haiku-ui session fixtures conform to haiku-api SessionPayload", () => {
	for (const name of FIXTURES) {
		it(`${name} validates`, () => {
			const path = join(__dirname, "..", "test-fixtures", name)
			const raw = readFileSync(path, "utf-8")
			const parsed = JSON.parse(raw)
			const result = SessionPayloadSchema.safeParse(parsed)
			if (!result.success) {
				throw new Error(
					`${name} failed SessionPayload validation: ${JSON.stringify(result.error.issues, null, 2)}`,
				)
			}
			expect(result.success).toBe(true)
		})
	}
})
