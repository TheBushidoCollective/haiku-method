// global-settings.ts — user-level (GLOBAL) settings at `~/.haiku/settings.json`.
//
// DISTINCT from the per-project `.haiku/settings.json` (the `haiku_settings_*`
// tools + `plugin/schemas/settings.schema.json`). This file holds machine-wide
// state that isn't repo-specific — today, the provider OAuth tokens captured by
// the haikumethod.ai auth broker (GitHub / GitLab), used by the engine's MR/PR
// operations and the proof-upload tool so they hit the provider REST API
// directly instead of shelling out to `gh`/`glab`.
//
// Tokens are CLIENT-ONLY: the broker relays a token here once and persists
// nothing long-term; refresh re-runs the relay (the website holds the OAuth
// client secret, not us). So this file is the sole durable home for a token.
//
// Path override: HAIKU_GLOBAL_DIR (absolute) wins over `~/.haiku` — load-bearing
// for tests (they point it at a temp dir so a test run never reads/writes the
// real user file) and for any sandbox that relocates the home tree.
//
// All readers tolerate a missing / empty / corrupt file (return null / empty,
// never throw to the caller) — a broken global file must never break a tick.
// Writes are atomic (temp + rename) with 0600 perms so a token is never
// world-readable and a crashed write can't leave a half-written file.

import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import {
	type GlobalSettings,
	PROVIDER_NAMES,
	type ProviderName,
	type ProviderToken,
	validateGlobalSettingsSchema,
} from "./state/schemas/global-settings.js"

/** The global `~/.haiku` dir (or `$HAIKU_GLOBAL_DIR` when set). */
export function globalHaikuDir(): string {
	const override = process.env.HAIKU_GLOBAL_DIR?.trim()
	if (override && override.length > 0) return override
	return join(homedir(), ".haiku")
}

/** Absolute path to `~/.haiku/settings.json`. */
export function globalSettingsPath(): string {
	return join(globalHaikuDir(), "settings.json")
}

/** Read + validate the global settings, or an empty object when the file is
 *  absent / unreadable / fails the schema. Never throws. */
function readGlobalSettings(): GlobalSettings {
	const path = globalSettingsPath()
	if (!existsSync(path)) return {}
	let parsed: unknown
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"))
	} catch {
		return {} // corrupt JSON — treat as empty rather than crash a tick
	}
	if (!validateGlobalSettingsSchema(parsed)) return {}
	return parsed as GlobalSettings
}

/** Atomic 0600 write of the whole settings object. Temp-then-rename so a
 *  crash mid-write can't truncate the live file; chmod before rename so the
 *  token is never briefly world-readable. */
function writeGlobalSettings(settings: GlobalSettings): void {
	const path = globalSettingsPath()
	mkdirSync(dirname(path), { recursive: true })
	const tmp = `${path}.tmp-${process.pid}`
	writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
	try {
		chmodSync(tmp, 0o600)
	} catch {
		/* best-effort — some filesystems ignore mode */
	}
	renameSync(tmp, path)
}

/** Read one provider's stored token, or null when absent. */
export function readProviderToken(
	provider: ProviderName,
): ProviderToken | null {
	const settings = readGlobalSettings()
	return settings.providers?.[provider] ?? null
}

/** Persist one provider's token (replacing any prior). Validated before write —
 *  an invalid bundle throws (callers build it from the broker response, which
 *  the tool layer schema-checks first). */
export function writeProviderToken(
	provider: ProviderName,
	token: ProviderToken,
): void {
	const settings = readGlobalSettings()
	const providers = { ...(settings.providers ?? {}) }
	providers[provider] = token
	const next: GlobalSettings = { ...settings, providers }
	if (!validateGlobalSettingsSchema(next)) {
		throw new Error(
			`global_settings_invalid: refusing to write malformed provider token for '${provider}'`,
		)
	}
	writeGlobalSettings(next)
}

/** Remove one provider's token. Returns true when a token was actually
 *  present (so callers can report `was_connected`). No-op + false otherwise. */
export function clearProviderToken(provider: ProviderName): boolean {
	const settings = readGlobalSettings()
	if (!settings.providers?.[provider]) return false
	const providers = { ...settings.providers }
	delete providers[provider]
	writeGlobalSettings({ ...settings, providers })
	return true
}

/** A token's expiry state — `null` expires_at means non-expiring (a PAT-style
 *  token), so `expired` is false. */
function isExpired(token: ProviderToken): boolean {
	if (!token.expires_at) return false
	const t = Date.parse(token.expires_at)
	if (Number.isNaN(t)) return false // unparseable → don't claim expired
	return t <= Date.now()
}

/** Connected-provider summary for `haiku_auth_status` — NEVER includes the
 *  access/refresh token values, only the safe metadata + a derived `expired`. */
export interface ProviderStatus {
	provider: ProviderName
	account: string | null
	scopes: string[]
	host: string
	expires_at: string | null
	expired: boolean
}

/** List every connected provider's status (token values omitted). */
export function listConnectedProviders(): ProviderStatus[] {
	const settings = readGlobalSettings()
	const out: ProviderStatus[] = []
	for (const provider of PROVIDER_NAMES) {
		const token = settings.providers?.[provider]
		if (!token) continue
		out.push({
			provider,
			account: token.account ?? null,
			scopes: token.scopes ?? [],
			host: token.host,
			expires_at: token.expires_at ?? null,
			expired: isExpired(token),
		})
	}
	return out
}
