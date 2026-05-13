import { withAuthQuery } from "../../../api/auth"

/**
 * Tunnel-served asset paths whose responses require the JWT gate
 * (FB-30). External http/https URLs pass through untouched.
 *
 * This is the canonical list — any new tunnel-served prefix added on
 * the server (`packages/haiku/src/http/`) must be added here so the
 * SPA stamps the JWT before requesting it.
 */
export const TUNNEL_ASSET_PREFIXES = [
	"/files/",
	"/mockups/",
	"/wireframe/",
	"/stage-artifacts/",
	"/question-image/",
]

/**
 * If `url` is a tunnel-served path, stamp the JWT auth query;
 * otherwise return it unchanged (external https, mailto, data:, etc.).
 */
export function authedAssetUrl(url: string | undefined | null): string {
	if (!url) return ""
	return TUNNEL_ASSET_PREFIXES.some((p) => url.startsWith(p))
		? withAuthQuery(url)
		: url
}
