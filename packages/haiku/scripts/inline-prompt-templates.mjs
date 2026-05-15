// scripts/inline-prompt-templates.mjs — esbuild plugin that inlines
// prompt template files at bundle time.
//
// Pattern: any `.ts` file under `src/orchestrator/prompts/` that calls
// loadTemplate(import.meta.url) (defaults to template.eta.md) or
// loadTemplate(import.meta.url, "<name>") gets every such call site
// replaced with a JSON-stringified literal of the named sibling file.
// The runtime helper (`prompts/_load-template.ts`) is used for
// dev/test (tsx, bun, plain node); the plugin replaces it for the
// bundled production build so `plugin/bin/haiku.mjs` ships as a
// single file with every template inlined as a string constant.
//
// Filter is the prompts subtree. Two layouts use this:
//
//   - Per-action prompt: prompts/<action>/index.ts loads template.eta.md
//   - Shared blocks: prompts/_shared/index.ts loads named .md siblings
//     (announcement, error-recovery, contracts).

import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

const DEFAULT_TEMPLATE = "template.eta.md"
const CALL_PATTERN =
	/loadTemplate\(\s*import\.meta\.url\s*(?:,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*)?,?\s*\)/g

/** @type {import("esbuild").Plugin} */
export const inlinePromptTemplatesPlugin = {
	name: "inline-prompt-templates",
	setup(build) {
		build.onLoad(
			{ filter: /[\\/]orchestrator[\\/]prompts[\\/].+\.ts$/ },
			(args) => {
				const source = readFileSync(args.path, "utf8")
				if (!source.includes("loadTemplate(import.meta.url")) return null
				// Strip line + block comments before scanning so example
				// loadTemplate calls in docstrings don't get treated as real
				// call sites. Replacement preserves length / line numbers so
				// any error positions still point at the right spot.
				const codeOnly = source
					.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
					.replace(/(^|\n)\s*\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "))
				if (!codeOnly.includes("loadTemplate(import.meta.url")) return null
				const dir = dirname(args.path)
				const inlined = source.replaceAll(
					CALL_PATTERN,
					(match, nameLit, offset) => {
						// Skip matches that fell inside a stripped comment region —
						// codeOnly has spaces where comments were.
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
						const tplPath = join(dir, name)
						if (!existsSync(tplPath)) {
							throw new Error(
								`inline-prompt-templates: ${args.path} references missing template ${tplPath}`,
							)
						}
						return JSON.stringify(readFileSync(tplPath, "utf8"))
					},
				)
				return { contents: inlined, loader: "ts" }
			},
		)
	},
}
