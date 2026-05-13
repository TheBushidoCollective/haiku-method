/**
 * /review/:sessionId/stages/:stage/:tab — tab-allowlist regression.
 *
 * Pre-2026-05-13: the `VALID_TABS` constant in $tab.tsx was
 * `["overview", "units", "knowledge", "outputs"]` — missing
 * `"other"` despite the ReviewTab union widening in commit
 * ee1c784ae that introduced the catchall Other tab. Result: the
 * SPA's `/stages/<stage>/other` route 404'd with "No session
 * found" even when the session was valid.
 *
 * This test reads the source of $tab.tsx directly (the TanStack
 * Router `parseParams` callback can't easily be unit-tested
 * without spinning up the router) and asserts that the allowlist
 * covers every member of the ReviewTab union.
 */

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { ReviewTab } from "../../../../../../pages/review/shared/stage-tabs"

const HERE = dirname(fileURLToPath(import.meta.url))
const TAB_ROUTE_FILE = resolve(HERE, "..", "$tab.tsx")

// Each known ReviewTab value the SPA can navigate to. Kept here so a
// reader of the test can see what the union should contain.
//
// Compile-time exhaustiveness: the Exclude check below fails to compile
// when any ReviewTab member is absent from EXPECTED_TABS. The `satisfies`
// clause ensures every element is a valid ReviewTab (no extras). Together
// they enforce coverage in both directions.
const EXPECTED_TABS = [
	"overview",
	"units",
	"knowledge",
	"outputs",
	"other",
] as const satisfies readonly ReviewTab[]
// Fails to compile if any ReviewTab member is missing from EXPECTED_TABS.
type _Exhaustive = Exclude<ReviewTab, (typeof EXPECTED_TABS)[number]> extends never
	? true
	: never
const _exhaustive: _Exhaustive = true
void _exhaustive

describe("$tab.tsx — VALID_TABS allowlist", () => {
	it("VALID_TABS covers every ReviewTab the SPA can route to", () => {
		const src = readFileSync(TAB_ROUTE_FILE, "utf8")
		for (const tab of EXPECTED_TABS) {
			expect(src).toMatch(new RegExp(`"${tab}"`))
		}
	})

	it("VALID_TABS includes 'other' — the catchall regression pin", () => {
		// The specific tab that 404'd in v5.0.1. Pinned separately so
		// the failure message is direct if it ever regresses.
		const src = readFileSync(TAB_ROUTE_FILE, "utf8")
		const match = src.match(
			/const\s+VALID_TABS\s*:\s*ReviewTab\[\]\s*=\s*\[([\s\S]*?)\]/,
		)
		expect(match).not.toBeNull()
		const body = match?.[1] ?? ""
		expect(body).toContain('"other"')
	})
})
