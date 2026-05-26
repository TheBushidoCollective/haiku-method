#!/usr/bin/env npx tsx
// runtime-verifier-signoff-rule.test.mjs
//
// Every `runtime-verifier` mandate across every studio MUST carry the
// same load-bearing sign-off rule: the role passes ONLY by actually
// running/observing the deliverable via `haiku_view`; if it can't, it
// files BLOCKED and HOLDs — it never signs off on a recipe, a fix
// description, green CI, or a closed blocker. (Origin: 2026-05-26, the
// `automated-starlink-rental-platform` intent — `haiku_view` was broken,
// the runtime-verifier's blocker got auto-closed by the fix loop landing
// a boot recipe, and the intent sealed without the live check ever
// happening. The doctrine block carries the universal rule; this test
// pins that each studio's mandate restates it so the messaging is
// consistent everywhere a runtime-verifier runs.)

import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGIN = resolve(TEST_DIR, "..", "..", "..", "plugin")

const mandates = readdirSync(PLUGIN, { recursive: true })
	.map((p) => join(PLUGIN, p.toString()))
	.filter((p) => p.endsWith("/runtime-verifier.md"))

test("the studios ship runtime-verifier mandates (sanity)", () => {
	// Guards against a glob that silently matches nothing — a green run
	// over zero files would be a false pass.
	assert.ok(
		mandates.length >= 8,
		`expected the studio runtime-verifier mandates, found ${mandates.length}`,
	)
})

// Substrings every runtime-verifier mandate must carry. They're the
// invariant core of the rule; surface-specific wording around them is
// free to differ per studio (boot vs viewer, app vs artifact vs page).
const REQUIRED = [
	"haiku_view", // the verification handle is named
	"You pass ONLY if you actually", // pass requires actually running/observing
	"BLOCKED", // can't-observe → BLOCKED
	"HOLD", // …and HOLD, don't pass
	".haiku/boot.md` recipe", // a recipe is explicitly NOT a substitute
	"can't-verify decay into a pass", // the closing prohibition
]

for (const file of mandates) {
	const rel = file.slice(PLUGIN.length + 1)
	test(`runtime-verifier mandate carries the sign-off rule: ${rel}`, () => {
		const body = readFileSync(file, "utf8")
		for (const needle of REQUIRED) {
			assert.ok(
				body.includes(needle),
				`${rel} is missing the sign-off-rule phrase: "${needle}"`,
			)
		}
		// MUST NOT sign off — the two words may be split by markdown bold
		// (`MUST NOT** sign off`), so match across a short gap.
		assert.match(
			body,
			/MUST NOT\*{0,2}\s+sign off/i,
			`${rel} must forbid signing off without observation`,
		)
	})
}
