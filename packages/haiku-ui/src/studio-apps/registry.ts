/**
 * studio-apps/registry.ts — Auto-discovery for per-studio SPA
 * contributions.
 *
 * A studio that needs a richer rendering surface than the default
 * mime dispatch (e.g. hwdev's multi-pane schematic↔PCB↔3D explorer)
 * drops two files at `plugin/studios/<studio>/spa/`:
 *
 *   - `manifest.json` — declares which artifact kinds the studio
 *     handles and the mount slug.
 *   - `index.tsx` — default-exports a React component that takes
 *     `StudioAppProps` and renders the artifact in whatever shape
 *     the studio wants.
 *
 * Both files are discovered at SPA build time via Vite's
 * `import.meta.glob`. The registry maps `{ studio, kind }` →
 * `Component` lookups; ViewPage's renderer consults the registry
 * before falling back to the default mime dispatch.
 *
 * Studios with no `spa/` directory contribute nothing — the default
 * pipeline handles their artifacts. This file is the ENTIRE contract
 * a studio needs to know about; everything else (Tanstack route
 * wiring, asset serving, lifecycle) is shared infrastructure.
 */

import type { ComponentType } from "react"

export interface StudioAppProps {
	/** Authed tunnelled URL for the artifact. */
	url: string
	/** Intent-relative path of the artifact (e.g.
	 *  `stages/design/artifacts/board.kicad_pcb`). */
	artifact: string
	/** Intent slug. */
	intent: string
	/** Stage slug when the view session scopes to one; undefined for
	 *  intent-scope sessions. */
	stage?: string
	/** Display name (typically the filename) for headings / aria. */
	name: string
}

export interface StudioAppManifest {
	/** Studio slug this app belongs to. Must match the parent dir. */
	studio: string
	/** Display name shown in the artifact header. */
	display_name: string
	/** Artifact `RenderKind` values (or `*` for all) this app
	 *  contributes. Order matters — first manifest to claim a kind
	 *  wins. */
	contributes: readonly string[]
}

interface RegistryEntry {
	manifest: StudioAppManifest
	component: ComponentType<StudioAppProps>
}

// Vite's import.meta.glob resolves at build time. The relative
// path walks up out of packages/haiku-ui/src/ into the repo root and
// down into plugin/studios/<studio>/spa/.
//
// `eager: true` for manifests so the registry can be built
// synchronously at module load. `eager: false` for entry components
// so studios that contribute nothing don't pay any bundle cost when
// no one renders their artifacts.
const manifestModules = import.meta.glob<StudioAppManifest>(
	"../../../../plugin/studios/*/spa/manifest.json",
	{ eager: true, import: "default" },
)

// Eager on entries too. Each studio's `index.tsx` is small (the
// heavy viewer libs are CDN-loaded via SpecializedViewers), so the
// bundle-size cost of pre-loading every studio's app is bounded.
// Eager loading avoids a Suspense boundary inside ViewPage's
// renderer and keeps the registry a synchronous lookup.
const entryModules = import.meta.glob<ComponentType<StudioAppProps>>(
	"../../../../plugin/studios/*/spa/index.tsx",
	{ eager: true, import: "default" },
)

const registry = new Map<string, RegistryEntry>()

function studioFromPath(path: string): string | null {
	// path looks like ".../plugin/studios/<studio>/spa/manifest.json"
	const m = path.match(/\/plugin\/studios\/([^/]+)\/spa\/[^/]+$/)
	return m ? m[1] : null
}

for (const [path, manifest] of Object.entries(manifestModules)) {
	const studio = studioFromPath(path)
	if (!studio || studio !== manifest.studio) continue
	const entryPath = path.replace(/manifest\.json$/, "index.tsx")
	const component = entryModules[entryPath]
	if (!component) continue
	registry.set(studio, { manifest, component })
}

/**
 * Resolve a studio-contributed component for the given artifact
 * `kind`. Returns null when no studio claims this kind, in which
 * case the caller should fall back to the default mime dispatch.
 *
 * `kind` is `"image"`, `"pdf"`, `"kicad"`, etc. (the ViewPage
 * RenderKind). Manifests may also claim `"*"` to catch every kind
 * for that studio's artifacts — useful when the studio wants to own
 * the entire viewing surface for its intents.
 */
export function resolveStudioApp(
	studio: string | undefined,
	kind: string,
): ComponentType<StudioAppProps> | null {
	if (!studio) return null
	const entry = registry.get(studio)
	if (!entry) return null
	if (
		!entry.manifest.contributes.includes(kind) &&
		!entry.manifest.contributes.includes("*")
	) {
		return null
	}
	return entry.component
}

/** Test / debug helper — list every registered studio contribution. */
export function listStudioApps(): readonly StudioAppManifest[] {
	return [...registry.values()].map((e) => e.manifest)
}
