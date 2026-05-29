// tools/orchestrator/haiku_auth_login.ts — broker-driven provider OAuth login.
//
// Phase 3 of provider OAuth. Runs the haikumethod.ai auth-broker handshake:
//   1. POST {AUTH_PROXY}/cli/start  → { device_code, verification_url, ... }
//   2. open verification_url in the user's browser (best-effort)
//   3. POLL {AUTH_PROXY}/cli/poll until status:"ready" (or timeout)
//   4. writeProviderToken(provider, bundle)  → ~/.haiku/settings.json
//
// `provider` is OPTIONAL — when omitted it's inferred from the repo's origin
// host (github.com → github, gitlab host → gitlab). The access/refresh token
// is NEVER echoed back; the response is { ok, provider, account } only.
//
// The network + browser are factored behind an injectable LoginDeps so the
// handshake is unit-testable (start → pending → ready) without real I/O. The
// default deps use global fetch, a cross-platform browser open, and real time;
// tests pass their own fetch/now/sleep/openUrl.

import { spawn } from "node:child_process"
import { platform } from "node:os"
import {
	parseGitRemote,
	providerFromHost,
	readOriginRemoteUrl,
} from "../../git-worktree.js"
import { writeProviderToken } from "../../global-settings.js"
import type {
	ProviderName,
	ProviderToken,
} from "../../state/schemas/global-settings.js"
import {
	HAIKU_AUTH_LOGIN_INPUT_SCHEMA,
	type HaikuAuthLoginInput,
	validateHaikuAuthLoginInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

/** Default broker base URL; override with HAIKU_AUTH_PROXY_URL. */
export const DEFAULT_AUTH_PROXY_URL = "https://auth.haikumethod.ai"

/** Resolve the broker base URL (env override → default), trailing slash trimmed. */
export function authProxyBaseUrl(): string {
	const raw = process.env.HAIKU_AUTH_PROXY_URL?.trim()
	const base = raw && raw.length > 0 ? raw : DEFAULT_AUTH_PROXY_URL
	return base.replace(/\/+$/, "")
}

/** Broker `/cli/start` response — the device-flow ticket. */
export interface BrokerStartResponse {
	device_code: string
	verification_url: string
	/** Server-suggested poll interval (seconds). Optional; we clamp it. */
	interval?: number
	/** Overall expiry (seconds from now). Optional; we apply a default. */
	expires_in?: number
}

/** Broker `/cli/poll` response. `status` drives the loop. */
export interface BrokerPollResponse {
	status: "pending" | "ready" | "denied" | "expired"
	/** Present only when status === "ready". */
	token?: ProviderToken
	/** Optional human reason for denied/expired. */
	error?: string
}

/** Injectable dependencies so the handshake runs without real network/browser/time. */
export interface LoginDeps {
	fetch: typeof fetch
	/** Current epoch ms — injectable so timeout logic is testable. */
	now: () => number
	/** Resolve after `ms` — injectable so polls don't really sleep in tests. */
	sleep: (ms: number) => Promise<void>
	/** Open a URL in the user's browser — best-effort, never throws. */
	openUrl: (url: string) => void
}

/** Outcome of a successful handshake (token captured but NOT returned to caller). */
export interface LoginResult {
	provider: ProviderName
	account: string | null
}

const POLL_MIN_INTERVAL_MS = 1000
const POLL_MAX_INTERVAL_MS = 10_000
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

/** Best-effort cross-platform browser open. Detached + ignored stdio so it
 *  never blocks the tool; swallows every error (headless CI has no browser). */
function defaultOpenUrl(url: string): void {
	try {
		const plat = platform()
		const cmd =
			plat === "darwin" ? "open" : plat === "win32" ? "cmd" : "xdg-open"
		const args = plat === "win32" ? ["/c", "start", "", url] : [url]
		const child = spawn(cmd, args, { stdio: "ignore", detached: true })
		child.on("error", () => {
			/* no browser available — the verification_url is still in the response */
		})
		child.unref()
	} catch {
		/* never let an open failure break login */
	}
}

/** Default deps wired to real fetch / time / browser. */
export function defaultLoginDeps(): LoginDeps {
	return {
		fetch: (...a: Parameters<typeof fetch>) => fetch(...a),
		now: () => Date.now(),
		sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
		openUrl: defaultOpenUrl,
	}
}

/** Clamp a server-suggested interval (seconds) into our ms bounds. */
function pollIntervalMs(intervalSeconds: number | undefined): number {
	const ms = (intervalSeconds ?? 2) * 1000
	return Math.min(POLL_MAX_INTERVAL_MS, Math.max(POLL_MIN_INTERVAL_MS, ms))
}

/** Stable named errors the handshake can throw — caller maps to MCP error codes. */
export class LoginError extends Error {
	code: string
	constructor(code: string, message: string) {
		super(message)
		this.code = code
	}
}

/**
 * Run the full broker handshake for `provider`. Pure w.r.t. its deps — the test
 * drives start → pending → ready by scripting `deps.fetch`. On success it
 * persists the token via writeProviderToken and returns safe metadata only.
 */
export async function runBrokerLogin(
	provider: ProviderName,
	deps: LoginDeps,
	opts: { timeoutMs?: number } = {},
): Promise<LoginResult> {
	const base = authProxyBaseUrl()
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

	// 1) start
	const startRes = await deps.fetch(`${base}/cli/start`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ provider }),
	})
	if (!startRes.ok) {
		throw new LoginError(
			"auth_login_broker_start_failed",
			`broker /cli/start returned HTTP ${startRes.status}`,
		)
	}
	const start = (await startRes.json()) as BrokerStartResponse
	if (!start?.device_code || !start?.verification_url) {
		throw new LoginError(
			"auth_login_broker_start_invalid",
			"broker /cli/start response missing device_code or verification_url",
		)
	}

	// 2) open the verification URL (best-effort)
	deps.openUrl(start.verification_url)

	// 3) poll until ready / denied / expired / timeout
	const expiryCapMs = (start.expires_in ?? 0) * 1000
	const deadline =
		deps.now() + (expiryCapMs > 0 ? Math.min(timeoutMs, expiryCapMs) : timeoutMs)
	const waitMs = pollIntervalMs(start.interval)

	while (deps.now() < deadline) {
		const pollRes = await deps.fetch(`${base}/cli/poll`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ provider, device_code: start.device_code }),
		})
		if (!pollRes.ok) {
			throw new LoginError(
				"auth_login_broker_poll_failed",
				`broker /cli/poll returned HTTP ${pollRes.status}`,
			)
		}
		const poll = (await pollRes.json()) as BrokerPollResponse
		if (poll.status === "ready") {
			if (!poll.token?.access_token || !poll.token?.host) {
				throw new LoginError(
					"auth_login_broker_token_invalid",
					"broker reported ready but returned no usable token bundle",
				)
			}
			writeProviderToken(provider, poll.token)
			return { provider, account: poll.token.account ?? null }
		}
		if (poll.status === "denied") {
			throw new LoginError(
				"auth_login_denied",
				poll.error ?? "authorization was denied",
			)
		}
		if (poll.status === "expired") {
			throw new LoginError(
				"auth_login_expired",
				poll.error ?? "the authorization request expired",
			)
		}
		// status === "pending" → wait and re-poll
		await deps.sleep(waitMs)
	}

	throw new LoginError(
		"auth_login_timeout",
		"timed out waiting for the broker authorization to complete",
	)
}

/** Infer the provider from the repo's origin remote host, or null when there's
 *  no remote / the host isn't a recognized provider. */
export function inferProviderFromOrigin(): ProviderName | null {
	const origin = readOriginRemoteUrl()
	if (!origin) return null
	const parsed = parseGitRemote(origin)
	if (!parsed) return null
	return providerFromHost(parsed.host)
}

export default defineTool({
	name: "haiku_auth_login",
	description:
		"Authenticate a Git provider (github / gitlab) via the haikumethod.ai OAuth broker so the engine can drive PR/MR ops and proof upload over the provider REST API. Opens a verification URL in the browser, polls until you approve, and stores the token in ~/.haiku/settings.json. `provider` is optional — inferred from the repo's origin host when omitted. Never returns the token value.",
	inputSchema: jsonSchemaOf(HAIKU_AUTH_LOGIN_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuAuthLoginInputSchema,
			"haiku_auth_login",
		)
		if (inputErr) return inputErr
		const { provider: requested } = args as HaikuAuthLoginInput

		// The AJV enum gate already constrained `requested` to a PROVIDER_NAME (or
		// undefined); the TypeBox Static widens the spread enum to `string`.
		const provider =
			(requested as ProviderName | undefined) ?? inferProviderFromOrigin()
		if (!provider) {
			return text(
				JSON.stringify({
					ok: false,
					error: "auth_login_provider_unresolved",
					message:
						'could not infer the provider from the repo origin; pass provider: "github" or "gitlab"',
				}),
			)
		}

		try {
			const result = await runBrokerLogin(provider, defaultLoginDeps())
			return text(
				JSON.stringify({
					ok: true,
					provider: result.provider,
					account: result.account,
				}),
			)
		} catch (err) {
			if (err instanceof LoginError) {
				return text(
					JSON.stringify({ ok: false, error: err.code, message: err.message }),
				)
			}
			return text(
				JSON.stringify({
					ok: false,
					error: "auth_login_failed",
					message: err instanceof Error ? err.message : String(err),
				}),
			)
		}
	},
})
