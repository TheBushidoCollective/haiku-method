#!/usr/bin/env node
// CI guard: assert the migration-safety contract test SCENARIO markers
// (A–I) are present in the drift-detection-gate.test.mjs and
// upstream-reconciliation.test.mjs files.
//
// Why this exists: unit-04-migration-safety-tests stamped nine `// SCENARIO X:`
// markers across the two pre-tick gate test files. Each marker labels a
// migration-safety contract scenario:
//   A — silent establish on first sight (per-file-SHA)
//   B — next-tick fire after establish (per-file-SHA)
//   C — baseline-absent establish (per-file-SHA)
//   D — silent establish on first sight (corpus-fingerprint)
//   E — fingerprint match short-circuit (corpus-fingerprint)
//   F — fingerprint drift fire (corpus-fingerprint)
//   G — acknowledge unblocks (corpus-fingerprint)
//   H — kill-switch end-to-end no-op even with on-disk drift
//   I — writeBaselineSync failure → graceful degradation (no thrash)
//
// These markers are the human-readable contract. Companion script
// `check-ci-covers-drift-tests.mjs` (unit-03) guards file presence and
// total assertion count; this script guards that the contract scenarios
// themselves remain labelled and enumerable. A future refactor that
// renames a marker, drops a scenario, or "tidies up" the comments would
// silently delete the migration-safety contract without breaking a
// single sibling test. Fail loud here, not at incident-time.
//
// Symptom-vs-cause check: the marker is the cause (the labelled
// scenario), not the symptom (a passing test). A scenario can pass with
// the wrong assertion if its setup drifts. The marker pins the scenario
// to a specific contract clause.
//
// Usage: node scripts/check-migration-safety-markers.mjs
// Exit code: 0 = all 9 markers present in correct files, 1 = gap.

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const testDir = join(repoRoot, "packages", "haiku", "test")

// Each entry: marker letter -> { file, label } where label is the
// short identifier that must follow `// SCENARIO X:` in the source.
// The label is matched as a literal substring on the same line as the
// marker — a future rename of the contract clause must update both
// the source comment AND this script (which is the correct SRE
// behaviour: a rename is a contract change and must be intentional).
const MARKERS = [
	{ letter: "A", file: "drift-detection-gate.test.mjs", label: "migration-safety" },
	{ letter: "B", file: "drift-detection-gate.test.mjs", label: "migration-safety" },
	{ letter: "C", file: "drift-detection-gate.test.mjs", label: "migration-safety" },
	{ letter: "D", file: "upstream-reconciliation.test.mjs", label: "migration-safety" },
	{ letter: "E", file: "upstream-reconciliation.test.mjs", label: "migration-safety" },
	{ letter: "F", file: "upstream-reconciliation.test.mjs", label: "migration-safety" },
	{ letter: "G", file: "upstream-reconciliation.test.mjs", label: "migration-safety" },
	{ letter: "H", file: "drift-detection-gate.test.mjs", label: "migration-safety" },
	{ letter: "I", file: "drift-detection-gate.test.mjs", label: "migration-safety" },
]

let failures = 0
const lines = []

// 1. Each declared test file must exist on disk.
const filesNeeded = [...new Set(MARKERS.map((m) => m.file))]
for (const f of filesNeeded) {
	const full = join(testDir, f)
	if (!existsSync(full)) {
		lines.push(`  ✗ MISSING TEST FILE: packages/haiku/test/${f}`)
		failures++
	}
}

// 2. Each marker must appear at least once in its declared file with the
//    correct shape: `// SCENARIO <letter>:` AND the migration-safety label
//    on the same line. Both halves matter — the letter pins the
//    scenario, the label pins the contract category.
const sourceCache = new Map()
function readSource(file) {
	if (sourceCache.has(file)) return sourceCache.get(file)
	const full = join(testDir, file)
	if (!existsSync(full)) {
		sourceCache.set(file, "")
		return ""
	}
	const src = readFileSync(full, "utf8")
	sourceCache.set(file, src)
	return src
}

for (const { letter, file, label } of MARKERS) {
	const src = readSource(file)
	if (!src) continue // file-missing already counted in step 1
	// Match `// SCENARIO <letter>` (with optional trailing colon/whitespace
	// before the label substring on the same line). Anchor to start of
	// line (after optional leading whitespace) to avoid matching a stray
	// `SCENARIO A` token inside prose.
	const pattern = new RegExp(
		String.raw`^\s*//\s*SCENARIO\s+${letter}\b[^\n]*\b${label}\b`,
		"m",
	)
	if (!pattern.test(src)) {
		lines.push(
			`  ✗ MISSING MARKER: SCENARIO ${letter} (label "${label}") in ${file}`,
		)
		failures++
	} else {
		lines.push(`  ✓ SCENARIO ${letter} present in ${file}`)
	}
}

// 3. Sanity guard: every marker letter A–I is declared in MARKERS so
//    a future contributor cannot quietly delete a row from the table
//    above without the script noticing. Mirrors the assertion-count
//    guard in `check-ci-covers-drift-tests.mjs` — the table itself is
//    a contract.
const expected = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
const declared = new Set(MARKERS.map((m) => m.letter))
for (const letter of expected) {
	if (!declared.has(letter)) {
		lines.push(
			`  ✗ MARKERS table dropped scenario ${letter} — table edit looks accidental`,
		)
		failures++
	}
}

console.log("CI migration-safety marker coverage check")
console.log("─".repeat(60))
for (const l of lines) console.log(l)
console.log("─".repeat(60))

if (failures > 0) {
	console.error(
		`\nFAIL: ${failures} migration-safety marker gap(s). The nine SCENARIO`,
	)
	console.error(
		"      markers (A–I) lock in the migration-safety contract for the",
	)
	console.error(
		"      pre-tick drift and upstream-reconciliation gates. Restore the",
	)
	console.error(
		"      missing markers, or update this script's MARKERS table if the",
	)
	console.error("      contract has moved.")
	process.exit(1)
}

console.log(
	`\nOK: all ${MARKERS.length} migration-safety SCENARIO markers (A–I) present.`,
)
process.exit(0)
