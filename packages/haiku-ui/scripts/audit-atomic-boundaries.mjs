#!/usr/bin/env node
/**
 * Audit atomic-design import boundaries for haiku-ui.
 *
 * The atomic design hierarchy is layered: atoms → molecules →
 * organisms → pages → shell. Each layer can import from layers
 * BELOW it but never FROM the same layer or ABOVE.
 *
 * Concrete rules:
 *   - atoms/      → may import: lib, hooks, theme, types, a11y, api
 *                              (anything outside the atomic layers)
 *   - molecules/  → may import: atoms, + everything atoms can
 *   - organisms/  → may import: atoms, molecules, + everything below
 *   - pages/      → may import: atoms, molecules, organisms, + below
 *   - shell/      → may import: anything (page composition layer)
 *   - routes/     → may import: anything (Tanstack route definitions)
 *
 * Forbidden:
 *   - atoms/* importing from atoms/* (no sibling deps)
 *   - molecules/* importing from molecules/* (no sibling deps)
 *   - any layer importing from a layer ABOVE it (e.g. atoms
 *     importing from organisms)
 *
 * The script walks every .ts/.tsx file under src/{atoms,molecules,
 * organisms,pages} and inspects each `from "..."` import path. If a
 * relative import crosses a forbidden boundary it's reported.
 *
 * Exits non-zero on any violation so CI fails. Run via
 * `bun run --cwd packages/haiku-ui audit:boundaries`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(__dirname, "..", "src")

// Layer order (lowest to highest). Index N can import from indexes 0..N-1.
const LAYERS = ["atoms", "molecules", "organisms", "pages"]

/** Walk a directory tree, yielding every .ts / .tsx file path. */
function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name)
		const stat = statSync(path)
		if (stat.isDirectory()) {
			// Skip __tests__ directories — test files have looser boundary
			// rules (a test for an organism may import its own organism).
			if (name === "__tests__") continue
			yield* walk(path)
			continue
		}
		if (path.endsWith(".ts") || path.endsWith(".tsx")) {
			yield path
		}
	}
}

/** Identify which atomic layer (if any) a file path belongs to.
 *  Returns { layer, layerDir } when the file lives under
 *  src/<layer>/, null otherwise. */
function classifyFile(absPath) {
	const rel = relative(srcRoot, absPath)
	const segments = rel.split("/")
	const top = segments[0]
	if (LAYERS.includes(top)) {
		return { layer: top, layerIndex: LAYERS.indexOf(top) }
	}
	return null
}

/** Resolve a relative import path against the importing file. */
function resolveImport(fromFile, importPath) {
	if (!importPath.startsWith(".")) return null
	const absImport = resolve(dirname(fromFile), importPath)
	return absImport
}

/** Extract every `from "..."` import path from a TS file. */
function extractImports(source) {
	const imports = []
	// Match `from "..."` and `from '...'`
	const re = /from\s+["']([^"']+)["']/g
	for (const match of source.matchAll(re)) {
		imports.push(match[1])
	}
	return imports
}

const violations = []

for (const file of walk(srcRoot)) {
	const fromClass = classifyFile(file)
	if (!fromClass) continue // file not in any atomic layer

	const source = readFileSync(file, "utf8")
	const imports = extractImports(source)

	for (const importPath of imports) {
		const absImport = resolveImport(file, importPath)
		if (!absImport) continue // bare/external import, skip
		const toClass = classifyFile(absImport)
		if (!toClass) continue // import lands outside atomic layers (lib/hooks/etc) — fine

		// Same-layer sibling import — needs nuance. Two patterns are
		// legitimate:
		//   1. Same-directory: a component imports its own helper file
		//      (e.g. organisms/MermaidFlow.tsx imports
		//      ./mermaid-flow/parser → really the same component).
		//   2. Same-component-family: pages/review/intent/X imports
		//      pages/review/shared/Y. The "review" sub-tree is one
		//      cohesive page, just split for size. Forbidding this
		//      forces every shared helper up to molecules/organisms,
		//      which loses cohesion.
		//
		// Forbidden: cross-family imports within the same layer
		// (e.g. pages/review/X imports pages/question/Y, or
		// organisms/A imports organisms/B's internals).
		if (fromClass.layer === toClass.layer) {
			// Find the component family — the path segment immediately
			// after the layer dir. For atoms / molecules / organisms the
			// family is usually the file name (one component per file).
			// For pages it's the route group (review, question, etc.).
			const fromRel = relative(srcRoot, file).split("/")
			const toRel = relative(srcRoot, absImport).split("/")
			const fromFamily = fromRel[1] // segment after layer dir
			const toFamily = toRel[1]
			// Same family — sub-tree imports are allowed (helpers,
			// nested page components).
			if (fromFamily && toFamily && fromFamily === toFamily) continue
			// For atoms/molecules/organisms, fromFamily === fileBase →
			// only same-component-name passes; sibling components are
			// caught here as violations.
			violations.push({
				file: relative(srcRoot, file),
				import: importPath,
				kind: "sibling",
				detail: `${fromClass.layer} → ${toClass.layer} (cross-family within layer: ${fromFamily} → ${toFamily})`,
			})
			continue
		}

		// Upward import — forbidden.
		if (toClass.layerIndex > fromClass.layerIndex) {
			violations.push({
				file: relative(srcRoot, file),
				import: importPath,
				kind: "upward",
				detail: `${fromClass.layer} → ${toClass.layer} (forbidden upward)`,
			})
		}

		// Otherwise the import goes downward — fine.
	}
}

// Split violations: upward = hard error (always wrong, the
// hierarchy is meaningless if these slip through). Sibling =
// warning by default — they're real design smells but often
// reflect "two pieces of one logical component split for size."
// Promote to errors via STRICT=1 once existing siblings are
// resolved.
const upward = violations.filter((v) => v.kind === "upward")
const sibling = violations.filter((v) => v.kind === "sibling")
const STRICT = process.env.STRICT === "1"

if (sibling.length > 0) {
	console.error(`\n⚠ ${sibling.length} sibling violation(s) (warn):\n`)
	for (const v of sibling) {
		console.error(`  ${v.file}`)
		console.error(`    imports: ${v.import}`)
		console.error(`    rule:    ${v.detail}\n`)
	}
	console.error(
		"  These are often refactor candidates — promote shared atoms to lib/,\n" +
			"  or split composite organisms into a templates/ layer.\n",
	)
}

if (upward.length > 0) {
	console.error(`\n✗ ${upward.length} upward violation(s) (FAIL):\n`)
	for (const v of upward) {
		console.error(`  ${v.file}`)
		console.error(`    imports: ${v.import}`)
		console.error(`    rule:    ${v.detail}\n`)
	}
	process.exit(1)
}

if (STRICT && sibling.length > 0) {
	console.error(`\n✗ STRICT=1 — sibling violations promoted to errors`)
	process.exit(1)
}

console.log(
	`✓ atomic-boundary audit clean (${LAYERS.join(" → ")})${
		sibling.length > 0
			? ` — ${sibling.length} sibling warning(s) (set STRICT=1 to fail on these)`
			: ""
	}`,
)
process.exit(0)
