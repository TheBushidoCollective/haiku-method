import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export interface ChangelogEntry {
	version: string
	/** Calendar date from CHANGELOG.md (YYYY-MM-DD). Stable, human-readable. */
	date: string
	/** Full ISO 8601 timestamp from the version-bump commit. Distinct per
	 *  release even when several land on the same calendar day, so RSS
	 *  readers can detect the delta between versions. Falls back to the
	 *  calendar date at midnight UTC when git history is unavailable
	 *  (e.g. the changelog includes a version that was never bumped). */
	timestamp: string
	sections: ChangelogSection[]
}

export interface ChangelogSection {
	type: string
	items: string[]
}

const changelogPath = path.join(process.cwd(), "..", "CHANGELOG.md")
const repoRoot = path.join(process.cwd(), "..")

/** Map version → commit ISO timestamp by walking git log for the
 *  bump-version commits the release workflow produces. Cached in module
 *  scope — the changelog is read at build time so a single git invocation
 *  per build is fine. Returns an empty map when git is unavailable
 *  (e.g. a tarball install) and callers fall back to the calendar date. */
let _versionTimestamps: Map<string, string> | null = null
function getVersionTimestamps(): Map<string, string> {
	if (_versionTimestamps) return _versionTimestamps
	const map = new Map<string, string>()
	try {
		const out = execSync(
			'git log --format="%cI %s" --grep="bump version" --extended-regexp',
			{ cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
		)
		// Each line: "<ISO-ts> chore(plugin): bump version A.B.C -> X.Y.Z"
		// We pin the timestamp to the destination version (X.Y.Z) since that
		// is the version published by this commit.
		for (const line of out.split("\n")) {
			const m = line.match(/^(\S+).*?->\s*([\d.]+)\b/)
			if (!m) continue
			const ts = m[1]
			const ver = m[2]
			if (!map.has(ver)) map.set(ver, ts)
		}
	} catch {
		/* no git, no remap — callers fall back to calendar date */
	}
	_versionTimestamps = map
	return map
}

/**
 * Returns the raw markdown content of the CHANGELOG.md file,
 * excluding the preamble (title and format description).
 */
export function getChangelogContent(): string {
	if (!fs.existsSync(changelogPath)) {
		return ""
	}

	const fileContents = fs.readFileSync(changelogPath, "utf8")

	// Strip the preamble lines (title + description) before the first version heading
	const firstVersionIndex = fileContents.indexOf("\n## [")
	if (firstVersionIndex === -1) {
		return fileContents
	}

	return fileContents.slice(firstVersionIndex + 1)
}

/**
 * Parses the CHANGELOG.md into structured version entries.
 * Expects Keep a Changelog format with ## [version] - date headings
 * and ### Type subsections.
 */
export function getChangelog(): ChangelogEntry[] {
	if (!fs.existsSync(changelogPath)) {
		return []
	}

	const fileContents = fs.readFileSync(changelogPath, "utf8")
	const entries: ChangelogEntry[] = []

	// Split on version headings: ## [x.y.z] - YYYY-MM-DD
	const versionRegex = /^## \[([^\]]+)\]\s*-\s*(\S+)/gm
	const matches = [...fileContents.matchAll(versionRegex)]

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i]
		const version = match[1]
		const date = match[2]

		// Get the content between this version heading and the next (or EOF)
		const startIndex = (match.index ?? 0) + match[0].length
		const endIndex =
			i + 1 < matches.length ? (matches[i + 1].index ?? 0) : fileContents.length
		const sectionContent = fileContents.slice(startIndex, endIndex)

		// Parse subsections (### Added, ### Fixed, ### Changed, ### Other)
		const sections: ChangelogSection[] = []
		const sectionRegex = /^### (.+)/gm
		const sectionMatches = [...sectionContent.matchAll(sectionRegex)]

		for (let j = 0; j < sectionMatches.length; j++) {
			const sectionMatch = sectionMatches[j]
			const type = sectionMatch[1].trim()

			const sectionStart = (sectionMatch.index ?? 0) + sectionMatch[0].length
			const sectionEnd =
				j + 1 < sectionMatches.length
					? (sectionMatches[j + 1].index ?? 0)
					: sectionContent.length
			const itemsContent = sectionContent.slice(sectionStart, sectionEnd)

			// Extract list items, supporting two shapes:
			//   1. `- bullet text` followed by zero or more indented
			//      continuation lines (common-mark wrapping):
			//
			//        - **Plugin major bump.** The on-disk schema is now v4.
			//          The migrator at `packages/.../v0-to-v4.ts` runs on
			//          first read of any pre-v4 intent.
			//
			//   2. Plain prose blocks (no `-` prefix at all) — older
			//      entries write a single paragraph under the `### Fixed`
			//      heading without bulleting. The renderer treats each
			//      paragraph as one item so the prose still surfaces
			//      instead of falling through to "No notable changes."
			const items: string[] = []
			const lines = itemsContent.split("\n")
			let current: string | null = null
			let prose: string | null = null

			const flushBullet = () => {
				if (current !== null) {
					const collapsed = current.replace(/\s+/g, " ").trim()
					if (collapsed.length > 0) items.push(collapsed)
					current = null
				}
			}
			const flushProse = () => {
				if (prose !== null) {
					const collapsed = prose.replace(/\s+/g, " ").trim()
					if (collapsed.length > 0) items.push(collapsed)
					prose = null
				}
			}

			for (const raw of lines) {
				if (raw.startsWith("- ")) {
					flushBullet()
					flushProse()
					current = raw.slice(2)
				} else if (current !== null && /^\s+\S/.test(raw)) {
					// Indented continuation of the current bullet.
					current += ` ${raw.trim()}`
				} else if (current !== null && raw.trim() === "") {
					// Blank line ends the current bullet.
					flushBullet()
				} else if (raw.trim() === "") {
					flushProse()
				} else if (current === null) {
					// Plain prose paragraph (no bullet prefix). Accumulate
					// until the next blank line or the next bullet.
					prose = prose === null ? raw.trim() : `${prose} ${raw.trim()}`
				}
			}
			flushBullet()
			flushProse()

			if (items.length > 0) {
				sections.push({ type, items })
			}
		}

		const versionTimestamps = getVersionTimestamps()
		const timestamp = versionTimestamps.get(version) ?? `${date}T00:00:00Z`
		entries.push({ version, date, timestamp, sections })
	}

	return entries
}
