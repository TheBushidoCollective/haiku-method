// statusline/index.ts — `haiku statusline` CLI.
//
//   haiku statusline              → render mode (Claude Code calls this
//                                    every refresh; reads the status-line
//                                    JSON payload on stdin)
//   haiku statusline install      → wire `.claude/settings.json` to call
//                                    this binary, saving the user's
//                                    existing statusLine as the fallback
//   haiku statusline uninstall    → restore the saved fallback
//
// Fallback chaining: when there's no active haiku intent in the current
// tree, render mode execs the saved original status-line command (with
// the same stdin payload) and emits its output — so a haiku status line
// is purely additive and disappears cleanly when you're not in an intent.

import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { resolvePluginRoot } from "../config.js"
import { renderStatusline } from "./render.js"
import { resolveStatuslineState } from "./state.js"

const FALLBACK_FILE = "statusline-fallback.json"

interface FallbackRecord {
	/** The original `statusLine` object captured at install time, or null
	 *  if the user had none. */
	statusLine: unknown
}

/** Read all of stdin as a string (the Claude Code status-line payload). */
function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let buf = ""
		if (process.stdin.isTTY) {
			resolve("")
			return
		}
		process.stdin.setEncoding("utf8")
		process.stdin.on("data", (c) => {
			buf += c
		})
		process.stdin.on("end", () => resolve(buf))
		process.stdin.on("error", () => resolve(buf))
	})
}

/** Locate the `.haiku/` dir for the given cwd by walking up, or null. */
function findHaikuDir(startDir: string): string | null {
	let dir = startDir
	for (let i = 0; i < 30; i++) {
		const candidate = join(dir, ".haiku")
		if (existsSync(candidate)) return candidate
		const parent = dirname(dir)
		if (parent === dir) break
		dir = parent
	}
	return null
}

/** Read the saved fallback record from project `.haiku/` (preferred) or
 *  the global `~/.haiku/`. `home` is injectable for tests. */
function readFallback(cwd: string, home: string = homedir()): FallbackRecord | null {
	const candidates: string[] = []
	const projectHaiku = findHaikuDir(cwd)
	if (projectHaiku) candidates.push(join(projectHaiku, FALLBACK_FILE))
	candidates.push(join(home, ".haiku", FALLBACK_FILE))
	for (const path of candidates) {
		if (!existsSync(path)) continue
		try {
			return JSON.parse(readFileSync(path, "utf8")) as FallbackRecord
		} catch {
			/* try next */
		}
	}
	return null
}

/** Extract a runnable command string from a stored statusLine value. */
function fallbackCommand(record: FallbackRecord | null): string | null {
	if (!record) return null
	return statusLineCommand(record.statusLine)
}

/** Pull a `{ type: "command", command }` value out of any statusLine-shaped
 *  object (a settings file's `statusLine`, or a saved fallback record). */
function statusLineCommand(sl: unknown): string | null {
	const v = sl as { type?: unknown; command?: unknown } | null
	if (v && v.type === "command" && typeof v.command === "string" && v.command) {
		return v.command
	}
	return null
}

/** True when a command is OUR own status line (so we never exec it as a
 *  fallback — that would recurse). Our commands always carry both `haiku`
 *  and `statusline`; a user's unrelated `vim-statusline` carries neither
 *  `haiku` nor would match, so the both-token test avoids false positives. */
function isOwnCommand(cmd: string): boolean {
	return cmd.includes("statusline") && cmd.includes("haiku")
}

/** Read a settings file's `statusLine` command, or null when the file is
 *  absent / unparseable / has no command-type statusLine. */
function settingsStatusLineCommand(settingsPath: string): string | null {
	if (!existsSync(settingsPath)) return null
	try {
		const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
			statusLine?: unknown
		}
		return statusLineCommand(settings.statusLine)
	} catch {
		return null
	}
}

/** The project root for the given cwd — the dir that holds `.haiku/` (and,
 *  by convention, `.claude/`), or cwd itself when there's no `.haiku/`. */
function projectRoot(cwd: string): string {
	const haiku = findHaikuDir(cwd)
	return haiku ? dirname(haiku) : cwd
}

/** Resolve what the status line should fall through to when there's no
 *  active haiku intent. Reconstructs what Claude Code WOULD render if haiku
 *  weren't installed, by walking the settings files in Claude's precedence
 *  order (project-local → project → user) and, at whichever file haiku has
 *  clobbered with its own command, substituting the original statusLine we
 *  saved at install time. Falls back to the saved record alone when no
 *  settings file carries a usable line. Returns null when there's nothing
 *  to chain to (Claude Code then shows its built-in default).
 *
 *  `home` is injectable for tests; defaults to the real home dir.
 *  Exported for tests. */
export function resolveFallbackCommand(
	cwd: string,
	home: string = homedir(),
): string | null {
	const recordCmd = fallbackCommand(readFallback(cwd, home))
	const root = projectRoot(cwd)
	// Claude Code statusLine precedence, most-specific first.
	const files = [
		join(root, ".claude", "settings.local.json"),
		join(root, ".claude", "settings.json"),
		join(home, ".claude", "settings.json"),
	]
	for (const f of files) {
		const cmd = settingsStatusLineCommand(f)
		if (!cmd) continue
		if (isOwnCommand(cmd)) {
			// This is the file haiku installed into — its original line lives
			// in the saved record. Use it; if the record is empty, this
			// precedence level genuinely had no line, so keep descending.
			if (recordCmd && !isOwnCommand(recordCmd)) return recordCmd
			continue
		}
		return cmd // the user's real statusLine at this precedence level
	}
	// No settings file carried a usable line (or every one was ours with an
	// empty saved original) — last resort the saved record.
	if (recordCmd && !isOwnCommand(recordCmd)) return recordCmd
	return null
}

/** Render mode: emit the haiku line, or chain to the saved fallback. */
async function render(): Promise<void> {
	const raw = await readStdin()
	let cwd = process.cwd()
	try {
		const payload = raw ? JSON.parse(raw) : {}
		cwd =
			payload?.workspace?.current_dir ??
			payload?.cwd ??
			payload?.workspace?.project_dir ??
			cwd
	} catch {
		/* keep process.cwd() */
	}

	try {
		process.chdir(cwd)
	} catch {
		/* best-effort — engine resolution may still work from here */
	}

	const debug = !!process.env.HAIKU_STATUSLINE_DEBUG
	let state: ReturnType<typeof resolveStatuslineState> = null
	try {
		state = resolveStatuslineState()
	} catch (err) {
		if (debug)
			process.stderr.write(
				`[haiku statusline] resolveStatuslineState threw: ${
					err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
				}\n`,
			)
	}
	if (debug && !state)
		process.stderr.write(
			`[haiku statusline] no state (cwd=${process.cwd()})\n`,
		)
	if (state) {
		process.stdout.write(renderStatusline(state))
		return
	}

	// No active intent → chain to whatever Claude Code would otherwise
	// render: the original line we saved at install, reconstructed against
	// the live settings files (project → user) so a statusLine the user
	// keeps in a settings file we never clobbered still wins.
	const cmd = resolveFallbackCommand(cwd)
	if (!cmd) return // nothing to fall back to; Claude Code shows its default
	try {
		const out = execFileSync("sh", ["-c", cmd], {
			input: raw,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		})
		process.stdout.write(out)
	} catch {
		/* fallback command failed — emit nothing rather than an error line */
	}
}

/** The npm package the production status line resolves through `npx`. */
const NPM_PACKAGE = "@haiku/haiku"

/** True when the plugin is running from a production install location
 *  (a Claude Code marketplace/MCPB dir), or HAIKU_PROD forces it. Mirrors
 *  the discriminator in `plugin/bin/haiku`. */
function isProdInstall(root: string): boolean {
	if (process.env.HAIKU_PROD === "1") return true
	if (process.env.HAIKU_DEV === "1") return false
	return /\/\.claude\/(plugins|mcpb)\//.test(root)
}

/** The command Claude Code should invoke for the haiku status line.
 *  Claude Code runs the status-line command WITHOUT the plugin bin on
 *  PATH (a bare `haiku` exits 127), so we never rely on PATH.
 *
 *  - Production (published to npm / marketplace install): `npx -y
 *    <pkg> statusline`. npx resolves the published package, so the
 *    command survives plugin updates without a path that rots when the
 *    versioned install dir changes.
 *  - Dev checkout: the absolute path to the bin dispatcher (npx can't
 *    resolve an unpublished local package). The dispatcher pins an
 *    absolute CLAUDE_PLUGIN_ROOT for the render subprocess so studios
 *    resolve even though it runs from the user's project cwd. */
function selfCommand(): string {
	const root = resolvePluginRoot()
	if (root && isProdInstall(root)) {
		return `npx -y ${NPM_PACKAGE} statusline`
	}
	if (root) {
		const dispatcher = join(root, "bin", "haiku")
		if (existsSync(dispatcher)) return `${dispatcher} statusline`
	}
	return "haiku statusline"
}

function settingsTarget(global: boolean, cwd: string): {
	settingsPath: string
	haikuDir: string
} {
	if (global) {
		return {
			settingsPath: join(homedir(), ".claude", "settings.json"),
			haikuDir: join(homedir(), ".haiku"),
		}
	}
	return {
		settingsPath: join(cwd, ".claude", "settings.json"),
		haikuDir: join(cwd, ".haiku"),
	}
}

function install(args: string[]): void {
	const global = args.includes("--global")
	const cwd = process.cwd()
	const { settingsPath, haikuDir } = settingsTarget(global, cwd)

	let settings: Record<string, unknown> = {}
	if (existsSync(settingsPath)) {
		try {
			settings = JSON.parse(readFileSync(settingsPath, "utf8"))
		} catch {
			console.error(
				`haiku statusline install: ${settingsPath} is not valid JSON — fix or remove it first.`,
			)
			process.exit(1)
		}
	}

	const existing = settings.statusLine
	// Don't clobber our own command into the fallback on re-install.
	const cmd = selfCommand()
	const alreadyOurs =
		existing &&
		typeof existing === "object" &&
		typeof (existing as { command?: unknown }).command === "string" &&
		(existing as { command: string }).command.includes("statusline")

	if (!alreadyOurs) {
		mkdirSync(haikuDir, { recursive: true })
		writeFileSync(
			join(haikuDir, FALLBACK_FILE),
			JSON.stringify({ statusLine: existing ?? null }, null, 2),
		)
	}

	settings.statusLine = { type: "command", command: cmd, padding: 0 }
	mkdirSync(dirname(settingsPath), { recursive: true })
	writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
	console.error(
		`haiku statusline installed → ${settingsPath}\n  command: ${cmd}\n  fallback saved: ${alreadyOurs ? "(unchanged)" : join(haikuDir, FALLBACK_FILE)}`,
	)
}

function uninstall(args: string[]): void {
	const global = args.includes("--global")
	const cwd = process.cwd()
	const { settingsPath, haikuDir } = settingsTarget(global, cwd)

	if (!existsSync(settingsPath)) {
		console.error(`haiku statusline uninstall: no settings at ${settingsPath}`)
		return
	}
	let settings: Record<string, unknown>
	try {
		settings = JSON.parse(readFileSync(settingsPath, "utf8"))
	} catch {
		console.error(`haiku statusline uninstall: ${settingsPath} is not valid JSON`)
		process.exit(1)
	}

	const fallbackPath = join(haikuDir, FALLBACK_FILE)
	let restored: unknown = null
	if (existsSync(fallbackPath)) {
		try {
			restored = (JSON.parse(readFileSync(fallbackPath, "utf8")) as FallbackRecord)
				.statusLine
		} catch {
			/* leave restored null */
		}
	}

	if (restored) settings.statusLine = restored
	else delete settings.statusLine
	writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
	console.error(
		`haiku statusline uninstalled → ${settingsPath}\n  restored: ${restored ? "original statusLine" : "(none — removed)"}`,
	)
}

export async function runStatusline(args: string[]): Promise<void> {
	const sub = args[0]
	if (sub === "install") return install(args.slice(1))
	if (sub === "uninstall") return uninstall(args.slice(1))
	return render()
}
