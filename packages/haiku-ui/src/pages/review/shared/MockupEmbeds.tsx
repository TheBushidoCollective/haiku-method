import type { MockupInfo } from "../../../types"
import { authedAssetUrl } from "./asset-url"
import { isImageUrl } from "./section-helpers"

/**
 * Append `?t=<jwt>` to URLs served under the tunnel, leave other URLs
 * alone. `<img>` and `<iframe>` cannot attach an `Authorization` header
 * from the browser, so the token rides as a query param — the server's
 * `requireTunnelAuth` accepts either shape.
 *
 * Thin wrapper over the shared `authedAssetUrl` helper, narrowed to
 * the non-empty-string contract this file's callers actually use.
 */
function resolveAssetUrl(url: string): string {
	return authedAssetUrl(url) || url
}

/**
 * MockupEmbeds — renders a list of mockups either as inline images
 * (for image URLs) or as sandboxed iframes (for HTML/URL mockups).
 *
 * Used by `IntentReview` for intent-level mockups.
 */
export function MockupEmbeds({ mockups }: { mockups: MockupInfo[] }) {
	return (
		<>
			{mockups.map((m) => {
				const authedUrl = resolveAssetUrl(m.url)
				return (
					<div key={m.url} className="mt-4">
						<div className="flex items-center justify-between mb-2">
							<h4 className="text-sm font-medium text-stone-600 dark:text-stone-400">
								{m.label}
							</h4>
							<a
								href={authedUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
							>
								Open in new tab &#8599;
							</a>
						</div>
						{isImageUrl(m.url) ? (
							<img
								src={authedUrl}
								alt={m.label}
								className="max-w-full h-auto border border-stone-200 dark:border-stone-700 rounded-lg"
							/>
						) : (
							<iframe
								src={authedUrl}
								sandbox="allow-scripts allow-same-origin"
								className="w-full h-[600px] border border-stone-200 dark:border-stone-700 rounded-lg bg-white"
								title={m.label}
							/>
						)}
					</div>
				)
			})}
		</>
	)
}
