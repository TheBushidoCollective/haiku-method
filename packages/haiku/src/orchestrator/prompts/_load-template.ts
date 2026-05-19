// orchestrator/prompts/_load-template.ts — Read a prompt template
// from disk with a two-tier cascade (project override → plugin
// default). All engine prompt bodies live under `plugin/prompts/`;
// the per-prompt `index.ts` builders here in
// `packages/haiku/src/orchestrator/prompts/` only carry data-prep
// code and call `loadTemplate(...)` to fetch the body.
//
// Two accepted argument shapes for `loadTemplate(source, name?)`:
//
//   - **Dev / test** — `source = import.meta.url`. The helper derives
//     the per-prompt subpath (`<rel>`) AND the repo root from the
//     calling module's location (relative to
//     `<repoRoot>/packages/haiku/src/orchestrator/prompts/`). The
//     plugin default tier in dev points at
//     `<repoRoot>/plugin/prompts/<rel>/<name>` directly — no env
//     var, no plugin-root discovery — so the test fixture's cwd /
//     fake plugin root don't have to be set.
//
//   - **Bundled production build** — `source = "@canon:<rel-path>"`.
//     The build-time `canonicalize-prompt-templates` esbuild plugin
//     rewrites every dev-form call site to this sentinel form. At
//     runtime the helper resolves the plugin default tier through
//     `resolvePluginRoot()` (Claude Code's `CLAUDE_PLUGIN_ROOT` env
//     var, with `argv[1]` / `import.meta.url` fallbacks).
//
// Cascade for any canonical key `<rel>/<name>`:
//
//   1. `<cwd>/.haiku/prompts/<rel>/<name>`       ── project override
//   2. `<pluginPromptsRoot>/<rel>/<name>`        ── plugin default
//
// In-memory caching with mtime invalidation: each template is read
// once per process; subsequent loads stat the file and only re-read
// when the modification time advances. Edits during dev (or via
// project overlay drops) propagate without an MCP restart.

import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { resolvePluginRoot } from "../../config.js"

const SENTINEL_PREFIX = "@canon:"

// The source-side prefix the dev path strips off `import.meta.url` to
// recover the canonical `<rel>` portion plus the absolute repo root.
const SRC_PROMPTS_SEGMENT = "/packages/haiku/src/orchestrator/prompts/"

interface CacheEntry {
	body: string
	mtimeMs: number
	path: string
}

const templateCache = new Map<string, CacheEntry>()
const overrideRegistry = new Map<string, string>()

/**
 * Test-only: inject a literal template body for a canonical key (the
 * `<rel>/<name>` form). Pass `null` to clear an entry. Use in tests
 * that need to assert on specific prompt content without touching
 * disk.
 */
export function setTemplateOverride(
	canonical: string,
	body: string | null,
): void {
	if (body === null) overrideRegistry.delete(canonical)
	else overrideRegistry.set(canonical, body)
}

/** Test-only: drop every override registered via setTemplateOverride. */
export function clearTemplateOverrides(): void {
	overrideRegistry.clear()
}

/**
 * Resolve the absolute path of a canonical template by walking the
 * cascade. `pluginPromptsRoot` is the absolute path to the plugin's
 * `prompts/` directory — for dev-mode calls it's derived from the
 * calling module's URL (avoids the `CLAUDE_PLUGIN_ROOT` env-var dance
 * during tests); for sentinel-mode calls it comes from
 * `resolvePluginRoot()`. Returns the first match; throws when neither
 * tier has the template, naming both paths so the failure is
 * debuggable.
 */
function resolveCanonical(
	canonical: string,
	pluginPromptsRoot: string,
): string {
	const projectPath = join(process.cwd(), ".haiku", "prompts", canonical)
	try {
		if (statSync(projectPath).isFile()) return projectPath
	} catch {
		// stat fails when the file doesn't exist; fall through to plugin.
	}
	const pluginPath = join(pluginPromptsRoot, canonical)
	try {
		if (statSync(pluginPath).isFile()) return pluginPath
	} catch {
		// fall through to throw below
	}
	throw new Error(
		`loadTemplate: could not find "${canonical}" — checked ${projectPath} and ${pluginPath}`,
	)
}

/**
 * Extract the canonical `<rel>` portion AND the absolute path to
 * `<repoRoot>/plugin/prompts/` from a dev-mode `import.meta.url`.
 *
 * The calling module always lives under
 * `<repoRoot>/packages/haiku/src/orchestrator/prompts/<rel>/<file>.ts`,
 * so splitting on the well-known segment gives us both halves in one
 * pass.
 */
function devModeContext(sourceUrl: string): {
	rel: string
	pluginPromptsRoot: string
} {
	const filePath = fileURLToPath(sourceUrl)
	const idx = filePath.indexOf(SRC_PROMPTS_SEGMENT)
	if (idx < 0) {
		throw new Error(
			`loadTemplate: import.meta.url is not under the prompts tree (${filePath})`,
		)
	}
	const repoRoot = filePath.slice(0, idx)
	const relWithFile = filePath.slice(idx + SRC_PROMPTS_SEGMENT.length)
	const lastSlash = relWithFile.lastIndexOf("/")
	const rel = lastSlash < 0 ? "" : relWithFile.slice(0, lastSlash)
	return { rel, pluginPromptsRoot: join(repoRoot, "plugin", "prompts") }
}

/**
 * Read a template body, using the in-memory cache when the on-disk
 * mtime hasn't advanced. The cache key is the absolute path so the
 * dev (URL-derived) and production (cascade-derived) paths share the
 * same cache when they happen to resolve to the same file.
 */
function readWithCache(absPath: string): string {
	const mtimeMs = statSync(absPath).mtimeMs
	const cached = templateCache.get(absPath)
	if (cached && cached.mtimeMs >= mtimeMs) return cached.body
	const body = readFileSync(absPath, "utf8")
	templateCache.set(absPath, { body, mtimeMs, path: absPath })
	return body
}

/**
 * Load a prompt template by canonical key (the `<rel>/<name>` form,
 * derived from either `import.meta.url` or the build-time `"@canon:"`
 * sentinel). Returns the file body; throws if no tier has the file.
 *
 * `name` defaults to `"template.eta.md"` for the per-prompt
 * convention; pass an explicit name for the `_shared` multi-file
 * pattern (`announcement.md`, `subagent-error-recovery.md`, etc.).
 */
export function loadTemplate(source: string, name = "template.eta.md"): string {
	let rel: string
	let pluginPromptsRoot: string
	if (source.startsWith(SENTINEL_PREFIX)) {
		rel = source.slice(SENTINEL_PREFIX.length)
		pluginPromptsRoot = join(resolvePluginRoot(), "prompts")
	} else {
		const ctx = devModeContext(source)
		rel = ctx.rel
		pluginPromptsRoot = ctx.pluginPromptsRoot
	}
	const canonical = rel ? `${rel}/${name}` : name
	const override = overrideRegistry.get(canonical)
	if (override !== undefined) return override
	const absPath = resolveCanonical(canonical, pluginPromptsRoot)
	return readWithCache(absPath)
}

/**
 * Drop every cached read. Useful in long-lived processes where the
 * underlying files may have been replaced atomically (e.g. plugin
 * update). Production callers don't need this; mtime invalidation
 * handles the common edit-while-running case.
 */
export function _clearTemplateCacheForTests(): void {
	templateCache.clear()
}

/**
 * Test-only: reset our local template cache. Kept here so the
 * template-cascade test can clear cache without reaching into config
 * internals.
 */
export function _resetPluginRootForTests(): void {
	templateCache.clear()
}
