#!/usr/bin/env node
// gen-harness-commands.mjs — Generate per-harness command files from the
// canonical Claude `skills/<name>/SKILL.md` sources.
//
// H·AI·K·U's skills are the single source of truth. Claude Code and Codex
// consume `skills/<name>/SKILL.md` directly (their plugin manifests carry a
// `skills` key). Gemini CLI and OpenCode have their own command formats, so
// we DERIVE those from the same SKILL.md bodies instead of hand-maintaining
// parallel copies:
//
//   Gemini  → plugin/commands/<name>.toml            ( /haiku:<name> )
//   OpenCode → plugin/.opencode/command/haiku/<name>.md ( /haiku:<name> )
//
// Re-run after editing any SKILL.md. Generated files are committed so the
// npm package ships them; this script is the regenerator, not a runtime dep.

import {
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = join(__dir, "..", "..", "..", "plugin")
const skillsDir = join(pluginRoot, "skills")
const geminiCmdDir = join(pluginRoot, "commands")
const opencodeCmdDir = join(pluginRoot, ".opencode", "command", "haiku")

// Skills that only make sense inside Claude Code (status line, etc.) — skip
// them for harnesses that have no equivalent surface.
const CLAUDE_ONLY = new Set(["haiku-statusline"])

/** Split a SKILL.md into { name, description, body }. Frontmatter is a
 *  leading `---` block with `name:` and `description:` keys. */
function parseSkill(raw) {
	const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
	if (!m) return { name: null, description: "", body: raw.trim() }
	const fm = m[1]
	const body = m[2].trim()
	const nameMatch = fm.match(/^name:\s*(.+)$/m)
	const descMatch = fm.match(/^description:\s*(.+)$/m)
	const strip = (s) => s?.trim().replace(/^["']|["']$/g, "") ?? ""
	return {
		name: strip(nameMatch?.[1]),
		description: strip(descMatch?.[1]),
		body,
	}
}

/** TOML basic-string escaping for the description line. */
function tomlStr(s) {
	return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/** TOML multi-line basic string — escape a closing-delimiter collision. */
function tomlMultiline(s) {
	return s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')
}

const skillNames = readdirSync(skillsDir, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name)
	.sort()

// Fresh-generate both dirs so removed skills don't leave orphans.
rmSync(geminiCmdDir, { recursive: true, force: true })
rmSync(opencodeCmdDir, { recursive: true, force: true })
mkdirSync(geminiCmdDir, { recursive: true })
mkdirSync(opencodeCmdDir, { recursive: true })

let geminiCount = 0
let opencodeCount = 0

for (const name of skillNames) {
	if (CLAUDE_ONLY.has(name)) continue
	let raw
	try {
		raw = readFileSync(join(skillsDir, name, "SKILL.md"), "utf8")
	} catch {
		continue
	}
	const { description, body } = parseSkill(raw)
	const desc = description || `H·AI·K·U ${name}`

	// Gemini: commands/<name>.toml → invoked as /haiku:<name> because the
	// extension namespaces commands by extension name.
	const toml = `description = "${tomlStr(desc)}"
prompt = """
${tomlMultiline(body)}
"""
`
	writeFileSync(join(geminiCmdDir, `${name}.toml`), toml)
	geminiCount++

	// OpenCode: .opencode/command/haiku/<name>.md → invoked as /haiku:<name>
	// (subdir namespacing). Frontmatter carries the one-line description.
	const md = `---
description: ${desc}
---

${body}
`
	writeFileSync(join(opencodeCmdDir, `${name}.md`), md)
	opencodeCount++
}

console.error(
	`Generated ${geminiCount} Gemini command(s) -> ${geminiCmdDir}`,
)
console.error(
	`Generated ${opencodeCount} OpenCode command(s) -> ${opencodeCmdDir}`,
)
