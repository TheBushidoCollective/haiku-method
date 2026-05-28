// scripts/canonicalize-prompt-templates.mjs — esbuild plugin that
// rewrites every `loadTemplate(import.meta.url, …)` call site under
// `src/orchestrator/prompts/` to the build-time `"@canon:<rel-dir>"`
// sentinel form, so the bundled binary never tries to read its own
// `import.meta.url` at runtime.
//
// Template bodies live at `plugin/prompts/<rel-dir>/<name>` — that
// directory is the single source of truth, shipped with the plugin
// and consumed directly by the runtime cascade in `_load-template.ts`
// (no copy step). The build-time check here just verifies every
// referenced template exists at that location so a missing file
// fails fast at build time instead of at first tick.
//
// Two layouts use this:
//
//   - Per-action prompt: prompts/<scope>/<…>/index.ts loads template.eta.md
//   - Shared blocks: prompts/_shared/index.ts loads named .md siblings
//     (announcement, error-recovery, contracts).

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"

const DEFAULT_TEMPLATE = "template.eta.md"
const CALL_PATTERN =
	/loadTemplate\(\s*import\.meta\.url\s*(?:,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*)?,?\s*\)/g

/**
 * Build the esbuild plugin. Needs to know:
 *
 *   - `srcPromptsRoot`: absolute path to
 *     `packages/haiku/src/orchestrator/prompts/`. The directory of
 *     each `index.ts` being bundled is rendered as a `<rel-dir>` key
 *     relative to this root.
 *   - `pluginPromptsRoot`: absolute path to `plugin/prompts/`. Used
 *     only for the build-time existence check that every referenced
 *     template body is present.
 *
 * @param {{ srcPromptsRoot: string, pluginPromptsRoot: string }} options
 * @returns {import("esbuild").Plugin}
 */
export function canonicalizePromptTemplatesPlugin({
	srcPromptsRoot,
	pluginPromptsRoot,
}) {
	return {
		name: "canonicalize-prompt-templates",
		setup(build) {
			build.onLoad(
				{ filter: /[\\/]orchestrator[\\/]prompts[\\/].+\.ts$/ },
				(args) => {
					const source = readFileSync(args.path, "utf8")
					// Cheap early-exit: skip files that don't even mention
					// `loadTemplate`. Loose substring to survive multi-line
					// call formatting.
					if (!source.includes("loadTemplate(")) return null
					// Strip line + block comments before scanning so example
					// loadTemplate calls in docstrings don't trigger rewrite.
					// Preserve length / line numbers so any error positions
					// still point at the right spot.
					const codeOnly = source
						.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
						.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "))
					if (!codeOnly.includes("loadTemplate(")) return null
					const dir = dirname(args.path)
					// rel-dir: posix-style path of `dir` relative to
					// srcPromptsRoot. The sentinel keys use forward slashes
					// regardless of host OS so they're stable across
					// platforms when the bundle gets shipped.
					const relDir = relative(srcPromptsRoot, dir).split(sep).join("/")
					const rewritten = source.replaceAll(
						CALL_PATTERN,
						(match, nameLit, offset) => {
							// Skip matches that fell inside a stripped comment region.
							if (codeOnly.slice(offset, offset + match.length).trim() === "") {
								return match
							}
							const name = nameLit
								? JSON.parse(
										nameLit.startsWith("'")
											? `"${nameLit.slice(1, -1).replaceAll('"', '\\"')}"`
											: nameLit,
									)
								: DEFAULT_TEMPLATE
							const tplPath = join(pluginPromptsRoot, relDir, name)
							if (!existsSync(tplPath)) {
								throw new Error(
									`canonicalize-prompt-templates: ${args.path} references missing template ${tplPath}`,
								)
							}
							// Rewrite the call to use the sentinel form the
							// loader expects in production. `@canon:` prefix is
							// what `_load-template.ts` matches on.
							const sentinel = `"@canon:${relDir}"`
							return nameLit
								? `loadTemplate(${sentinel}, ${nameLit})`
								: `loadTemplate(${sentinel})`
						},
					)
					if (rewritten === source) return null
					return { contents: rewritten, loader: "ts" }
				},
			)
		},
	}
}
