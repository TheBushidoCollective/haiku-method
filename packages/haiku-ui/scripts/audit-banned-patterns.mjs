#!/usr/bin/env node
/**
 * audit-banned-patterns.mjs — scans the haiku-ui package for banned regex
 * patterns defined in audit-config.json.
 *
 * Usage:
 *   node packages/haiku-ui/scripts/audit-banned-patterns.mjs [--profile=tokens|stage-wide]
 *
 * Exit codes:
 *   0 — every profile rule returned zero hits
 *   1 — one or more rules hit; stdout lists each hit with file:line
 *   2 — config error (missing config file, invalid regex, etc.)
 *
 * Canonical source: knowledge/DESIGN-TOKENS.md §1.1a (banned pairs), §1.4
 * (typography floor), §1.7 (disabled-opacity ban), §2.6 (canonical verbs).
 */
import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_DIR = path.resolve(SCRIPT_DIR, "..")
const REPO_ROOT = path.resolve(PACKAGE_DIR, "../..")
const CONFIG_PATH = path.join(PACKAGE_DIR, "audit-config.json")

const argv = process.argv.slice(2)
let profileName = "tokens"
for (const arg of argv) {
	if (arg.startsWith("--profile=")) profileName = arg.slice("--profile=".length)
}

function globToRegExp(glob) {
	// Minimal glob → RegExp: supports **, *, ?, and {a,b,c} alternation.
	let out = ""
	let i = 0
	while (i < glob.length) {
		const ch = glob[i]
		if (ch === "*" && glob[i + 1] === "*") {
			out += ".*"
			i += 2
			if (glob[i] === "/") i += 1
			continue
		}
		if (ch === "*") {
			out += "[^/]*"
			i += 1
			continue
		}
		if (ch === "?") {
			out += "[^/]"
			i += 1
			continue
		}
		if (ch === "{") {
			const end = glob.indexOf("}", i)
			if (end < 0) {
				out += "\\{"
				i += 1
				continue
			}
			const alt = glob
				.slice(i + 1, end)
				.split(",")
				.map((s) => s.replace(/([.+^$()|\[\]\\])/g, "\\$1"))
				.join("|")
			out += `(?:${alt})`
			i = end + 1
			continue
		}
		if (/[.+^$()|[\]\\]/.test(ch)) {
			out += `\\${ch}`
		} else {
			out += ch
		}
		i += 1
	}
	return new RegExp(`^${out}$`)
}

async function walk(dir, acc = []) {
	let entries
	try {
		entries = await readdir(dir, { withFileTypes: true })
	} catch {
		return acc
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === "dist") continue
			await walk(full, acc)
		} else if (entry.isFile()) {
			acc.push(full)
		}
	}
	return acc
}

function matchAny(relPath, globs) {
	return globs.some((glob) => globToRegExp(glob).test(relPath))
}

async function loadProfile(config, name, seen = new Set()) {
	if (seen.has(name)) {
		throw new Error(`audit-config profile cycle: ${[...seen, name].join(" → ")}`)
	}
	seen.add(name)
	const profile = config.profiles?.[name]
	if (!profile) {
		throw new Error(`Unknown profile '${name}' in audit-config.json`)
	}
	const rules = []
	if (profile.extends) {
		const parentRules = await loadProfile(config, profile.extends, seen)
		rules.push(...parentRules)
	}
	rules.push(...(profile.rules ?? []))
	return rules
}

async function main() {
	let config
	try {
		config = JSON.parse(await readFile(CONFIG_PATH, "utf8"))
	} catch (err) {
		console.error(`audit-banned-patterns: failed to read ${CONFIG_PATH}`)
		console.error(err instanceof Error ? err.message : String(err))
		process.exit(2)
	}

	let rules
	try {
		rules = await loadProfile(config, profileName)
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err))
		process.exit(2)
	}

	// Pre-compile each rule's scope + exclude globs + pattern.
	const compiled = rules.map((rule) => {
		if (
			typeof rule.pattern !== "string" ||
			!Array.isArray(rule.scope) ||
			!Array.isArray(rule.exclude)
		) {
			throw new Error(`Rule '${rule.id}' missing pattern/scope/exclude`)
		}
		return {
			...rule,
			regex: new RegExp(rule.pattern, "g"),
			scopeRegex: rule.scope.map(globToRegExp),
			excludeRegex: rule.exclude.map(globToRegExp),
		}
	})

	// Walk once from repo root, filter against each rule's scope.
	const all = await walk(REPO_ROOT)
	const fileContents = new Map()
	let totalHits = 0
	const hitsByRule = new Map()

	for (const rule of compiled) {
		let ruleHits = 0
		for (const absFile of all) {
			const rel = path.relative(REPO_ROOT, absFile).replaceAll(path.sep, "/")
			const inScope = rule.scopeRegex.some((re) => re.test(rel))
			if (!inScope) continue
			const excluded = rule.excludeRegex.some((re) => re.test(rel))
			if (excluded) continue
			let content = fileContents.get(absFile)
			if (content === undefined) {
				try {
					content = await readFile(absFile, "utf8")
				} catch {
					continue
				}
				fileContents.set(absFile, content)
			}
			// Rewind the regex before every use — `g` flag keeps lastIndex state.
			rule.regex.lastIndex = 0
			let match
			const lines = content.split("\n")
			for (let i = 0; i < lines.length; i += 1) {
				const line = lines[i]
				const localRe = new RegExp(rule.pattern, "g")
				while ((match = localRe.exec(line)) !== null) {
					totalHits += 1
					ruleHits += 1
					console.log(
						`BANNED [${rule.id}] ${rel}:${i + 1} — ${rule.description}`,
					)
					console.log(`  → ${line.trim()}`)
					if (match.index === localRe.lastIndex) localRe.lastIndex += 1
				}
			}
		}
		hitsByRule.set(rule.id, ruleHits)
	}

	console.log("")
	console.log(
		`audit-banned-patterns · profile=${profileName} · ${compiled.length} rules · ${totalHits} hits`,
	)
	for (const rule of compiled) {
		const n = hitsByRule.get(rule.id) ?? 0
		const marker = n === 0 ? "OK" : "FAIL"
		console.log(`  [${marker}] ${rule.id} — ${n} hit${n === 1 ? "" : "s"}`)
	}

	process.exit(totalHits === 0 ? 0 : 1)
}

// Guard against Node ESM top-level await not available in older versions —
// but we require Node 18+, so `await` at top of async main is fine.
// Silence linting hint.
void stat

main().catch((err) => {
	console.error(err)
	process.exit(2)
})
