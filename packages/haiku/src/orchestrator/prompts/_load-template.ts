// orchestrator/prompts/_load-template.ts — Load a per-prompt
// `template.eta.md` sibling file as a string.
//
// Two runtime paths:
//
//   - **Source / dev / tests** (tsx, bun, plain node) — `import.meta.url`
//     points at the per-prompt `index.ts`, so the helper resolves
//     `./template.eta.md` relative to it and reads the file from disk.
//
//   - **Bundled production build** (esbuild → `plugin/bin/haiku.mjs`) —
//     the `inline-prompt-templates` plugin in `scripts/build-mcp.mjs`
//     rewrites every `loadTemplate(import.meta.url)` call site at bundle
//     time to a literal string of the template's contents. This module
//     is then unused at runtime in the bundle. Keeping the helper is
//     intentional: it preserves the dev/test path and gives a single
//     spelling for the inline pattern the plugin scans for.
//
// Why not import the template via `with { type: "text" }`? Bun supports
// the text import attribute natively, but tsx 4.x and node do not, so
// the existing `npx tsx test/...` runners would break. Going through a
// runtime fs read keeps every runtime happy without forcing a
// test-runner swap.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function loadTemplate(
	metaUrl: string,
	name = "template.eta.md",
): string {
	return readFileSync(fileURLToPath(new URL(name, metaUrl)), "utf8")
}
