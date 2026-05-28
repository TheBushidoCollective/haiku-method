#!/usr/bin/env node
/**
 * Build the H·AI·K·U MCP server bundle.
 *
 * Pipeline (single entry point — no separate prebuild dance):
 *   1. Bundle the haiku-ui SPA via `bundle-haiku-ui.mjs` (vite build +
 *      inline into `src/haiku-ui-html.ts`). Skipped when
 *      `HAIKU_SKIP_SPA_BUNDLE=1` is set (useful for engine-only iterations
 *      that want to avoid the ~5s vite cost).
 *   2. Export the per-studio workflow Mermaid diagrams for the website.
 *      Skipped when `HAIKU_SKIP_WORKFLOW_DIAGRAMS=1` is set.
 *   3. Bundle main.ts via esbuild, inject Sentry DSNs and the plugin
 *      version via --define so they're baked into the binary rather
 *      than read from env vars at runtime.
 *
 * Both pre-steps used to live in `prebuild` in package.json. They were
 * lifted here so the build is one explicit script with one obvious
 * order, and so `npm run build -w @haiku/haiku` is the only command
 * needed to produce the shippable artifact.
 */
import { spawnSync } from "node:child_process"
import { chmodSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"
import { canonicalizePromptTemplatesPlugin } from "./canonicalize-prompt-templates.mjs"

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, "..")
const repoRoot = join(root, "..", "..")
const outfile = join(repoRoot, "plugin", "bin", "haiku.mjs")
const srcPromptsRoot = join(root, "src", "orchestrator", "prompts")
const pluginPromptsRoot = join(repoRoot, "plugin", "prompts")

function runStep(name, cmd, args, skipEnv) {
	if (skipEnv && process.env[skipEnv] === "1") {
		console.error(`[build-mcp] ${name} — skipped (${skipEnv}=1).`)
		return
	}
	console.error(`[build-mcp] ${name}…`)
	const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" })
	if (result.status !== 0) {
		console.error(`[build-mcp] ${name} failed (exit ${result.status}).`)
		process.exit(result.status || 1)
	}
}

// Step 1: bundle the haiku-ui SPA into src/haiku-ui-html.ts.
runStep(
	"Bundle haiku-ui SPA",
	"node",
	[join(__dir, "bundle-haiku-ui.mjs")],
	"HAIKU_SKIP_SPA_BUNDLE",
)

// Step 2: export per-studio workflow Mermaid diagrams.
runStep(
	"Export workflow diagrams",
	"npx",
	["tsx", join(__dir, "export-workflow-diagrams.mjs")],
	"HAIKU_SKIP_WORKFLOW_DIAGRAMS",
)

// Step 3: derive per-harness command files (Gemini TOML, OpenCode md)
// from the canonical skills/<name>/SKILL.md sources so they ship in sync.
runStep(
	"Generate per-harness commands",
	"node",
	[join(__dir, "gen-harness-commands.mjs")],
	"HAIKU_SKIP_HARNESS_COMMANDS",
)

// Build define flags — inline env vars at compile time
const sentryDsn = process.env.HAIKU_SENTRY_DSN_MCP || ""

// Read plugin version and bake it into the binary
const pluginJson = JSON.parse(
	readFileSync(
		join(repoRoot, "plugin", ".claude-plugin", "plugin.json"),
		"utf8",
	),
)
const mcpVersion = pluginJson.version

// Switched from the esbuild CLI (npx esbuild …) to the JS API so the
// `canonicalize-prompt-templates` plugin can run. The plugin rewrites
// every `loadTemplate(import.meta.url, …)` call in
// `src/orchestrator/prompts/<…>/index.ts` to a sentinel-bearing
// `loadTemplate("@canon:<rel-dir>", …)` form so the bundled binary
// doesn't try to read its own `import.meta.url` at runtime. Template
// bodies live at `plugin/prompts/<rel-dir>/<name>` (single source of
// truth, shipped with the plugin) and the runtime cascade in
// `_load-template.ts` resolves them with project overlays at
// `.haiku/prompts/<rel>` winning. No copy step — the build-time
// check just verifies every referenced template is present so a
// missing file fails fast here instead of at first tick.
//
// Templates on disk (vs inlined as string constants) is what makes
// the reflection project-overlay loop possible — a team can drop a
// revised mandate at `.haiku/prompts/…/template.eta.md` and the
// loader picks it up on the next render, no rebuild required.

try {
	await esbuild.build({
		absWorkingDir: root,
		entryPoints: ["src/main.ts"],
		bundle: true,
		platform: "node",
		format: "esm",
		treeShaking: true,
		minify: true,
		sourcemap: "external",
		outfile,
		banner: {
			js: 'import{createRequire}from"module";const require=createRequire(import.meta.url);',
		},
		define: {
			"process.env.HAIKU_SENTRY_DSN_MCP": JSON.stringify(sentryDsn),
			"process.env.HAIKU_MCP_VERSION": JSON.stringify(mcpVersion),
		},
		plugins: [
			canonicalizePromptTemplatesPlugin({
				srcPromptsRoot,
				pluginPromptsRoot,
			}),
		],
		logLevel: "info",
	})
} catch {
	process.exit(1)
}
chmodSync(outfile, 0o755)

console.error(`MCP server built -> ${outfile}`)
console.error(`MCP version: ${mcpVersion} (baked in)`)
if (sentryDsn) {
	console.error("Sentry DSN: baked in")
} else {
	console.error("Sentry DSN: not set (HAIKU_SENTRY_DSN_MCP empty)")
}
