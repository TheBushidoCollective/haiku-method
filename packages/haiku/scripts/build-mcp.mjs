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
import { inlinePromptTemplatesPlugin } from "./inline-prompt-templates.mjs"

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, "..")
const repoRoot = join(root, "..", "..")
const outfile = join(repoRoot, "plugin", "bin", "haiku.mjs")

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
// `inline-prompt-templates` plugin can run. The plugin rewrites every
// `loadTemplate(import.meta.url)` call in
// `src/orchestrator/prompts/<action>/index.ts` to a literal string of
// the sibling `template.eta.md`, so the bundled binary never has to
// fs-read template files at runtime.
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
		plugins: [inlinePromptTemplatesPlugin],
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
