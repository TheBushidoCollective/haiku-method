// orchestrator/prompts/_provider-loader.ts — Load configured provider
// docs and resolve which prompts they splice into.
//
// Two-tier cascade per provider:
//
//   1. <cwd>/.haiku/providers/<kind>.md   ── per-project override
//   2. <pluginRoot>/providers/<kind>.md   ── plugin default
//
// A provider is "active" when:
//   - it appears under `providers.<kind>:` in `.haiku/settings.yml`, OR
//   - its frontmatter declares `always_on: true` (git, in a git repo).
//
// Provider .md frontmatter shape:
//
//   provider_kind: git | ticketing | spec | knowledge | design
//   category: source | workflow
//   always_on: boolean
//   splices_into: [<phase-name>, ...]
//   description: <one-line>
//
// Splice-point names are semantic (elaborate, execute, seal_intent,
// complete_stage, decompose). Prompt builders ask
// `providersForSplicePoint("decompose", intentDir)` and get back the
// list to splice in.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { resolvePluginRoot } from "../../config.js"
import { findHaikuRoot, isGitRepo } from "../../state/shared.js"

export type ProviderCategory = "source" | "workflow"

export interface ProviderDoc {
	kind: string
	category: ProviderCategory
	alwaysOn: boolean
	splicesInto: string[]
	body: string
	path: string
}

/** Read `.haiku/settings.yml`. Returns an empty record on miss. The
 *  file is a flat YAML doc (no leading `---`); matter() needs the
 *  fences manually. */
function readSettings(intentDir: string): Record<string, unknown> {
	// intentDir is `.haiku/intents/<slug>`; settings.yml lives at
	// `.haiku/settings.yml`. Walk up to `.haiku/` and read the sibling.
	let dir = intentDir
	for (let i = 0; i < 4; i++) {
		const candidate = join(dir, "settings.yml")
		if (existsSync(candidate)) {
			try {
				const raw = readFileSync(candidate, "utf8")
				const { data } = matter(`---\n${raw}\n---\n`)
				return data as Record<string, unknown>
			} catch {
				return {}
			}
		}
		dir = join(dir, "..")
	}
	// Last try: derive from findHaikuRoot.
	try {
		const root = findHaikuRoot()
		const candidate = join(root, "settings.yml")
		if (existsSync(candidate)) {
			const raw = readFileSync(candidate, "utf8")
			const { data } = matter(`---\n${raw}\n---\n`)
			return data as Record<string, unknown>
		}
	} catch {
		/* not in a haiku root */
	}
	return {}
}

/** Cascade-resolve a provider doc by kind. Returns null when neither
 *  the project override nor the plugin default exists. */
function resolveProviderDocPath(kind: string): string | null {
	let root: string
	try {
		root = findHaikuRoot()
	} catch {
		root = process.cwd()
	}
	const override = join(root, "providers", `${kind}.md`)
	if (existsSync(override)) return override
	const pluginDefault = join(resolvePluginRoot(), "providers", `${kind}.md`)
	if (existsSync(pluginDefault)) return pluginDefault
	return null
}

function parseProviderDoc(path: string): ProviderDoc | null {
	try {
		const raw = readFileSync(path, "utf8")
		const parsed = matter(raw)
		const fm = parsed.data as Record<string, unknown>
		const kind = typeof fm.provider_kind === "string" ? fm.provider_kind : ""
		const category =
			fm.category === "source" || fm.category === "workflow"
				? (fm.category as ProviderCategory)
				: null
		if (!kind || !category) return null
		const alwaysOn = fm.always_on === true
		const splicesIntoRaw = Array.isArray(fm.splices_into)
			? (fm.splices_into as unknown[])
			: []
		const splicesInto = splicesIntoRaw.filter(
			(s): s is string => typeof s === "string",
		)
		return {
			kind,
			category,
			alwaysOn,
			splicesInto,
			body: parsed.content.trim(),
			path,
		}
	} catch {
		return null
	}
}

/** Per-provider environmental precondition. `always_on: true` means
 *  "on whenever the environment supports it" — git, specifically,
 *  applies only when we're actually in a git repo. Other always-on
 *  providers (none today) would declare their own predicate here.
 *  Returns true when the provider's environment is satisfied. */
function environmentApplies(kind: string): boolean {
	if (kind === "git") return isGitRepo()
	// No other always-on providers today.
	return true
}

/** List every provider that is active for the current intent. Active =
 *  (configured in settings.yml) OR (`always_on: true` AND its
 *  environmental precondition holds — e.g. git requires `.git/`). */
export function listActiveProviders(intentDir: string): ProviderDoc[] {
	const settings = readSettings(intentDir)
	const providersBlock =
		(settings.providers as Record<string, unknown> | undefined) ?? {}

	// All known provider kinds (one .md per kind in plugin/providers/).
	const KNOWN_KINDS = ["git", "ticketing", "spec", "knowledge", "design"]
	const out: ProviderDoc[] = []
	for (const kind of KNOWN_KINDS) {
		const path = resolveProviderDocPath(kind)
		if (!path) continue
		const doc = parseProviderDoc(path)
		if (!doc) continue
		const configured = providersBlock[kind] !== undefined
		if (configured) {
			out.push(doc)
			continue
		}
		if (doc.alwaysOn && environmentApplies(kind)) {
			out.push(doc)
		}
	}
	return out
}

/** Return the active providers that declare `splices_into: [phase]`.
 *  Phase is a semantic name (elaborate, execute, decompose,
 *  complete_stage, seal_intent). Empty list when no provider matches. */
export function providersForSplicePoint(
	phase: string,
	intentDir: string,
): ProviderDoc[] {
	return listActiveProviders(intentDir).filter((p) =>
		p.splicesInto.includes(phase),
	)
}
