/**
 * OutputThumbnail — 64×64 preview of an existing output artifact
 * (DESIGN-BRIEF Screen 2 Component inventory, unit-12).
 *
 * Render strategy keyed off `output.mime`:
 *   - image/* → <img> with lazy decoding and the same authed URL the
 *     OutputArtifactsTab uses for tunnel-served assets.
 *   - text/html → first-paint snapshot via a sandboxed iframe (the same
 *     pattern OutputArtifactsTab uses for HTML wireframes; here it is
 *     squeezed to thumbnail size with `pointer-events-none`).
 *   - text/markdown → first non-empty line of the content as plain text.
 *   - default fallback → file-icon placeholder + extension.
 *
 * Pure leaf atom. Does NOT fetch — `output.content` (markdown / html) and
 * `output.url` (image / asset path) come from the parent.
 *
 * Token discipline (DESIGN-TOKENS.md §1.4):
 *   - Tailwind utilities only — no raw hex.
 *   - Light + dark pairs across the placeholder/border surface.
 *   - No motion (placeholder is static); the parent dialog's reduced-
 *     motion guard covers entry animations.
 */

import type { CSSProperties } from "react"

export interface OutputThumbnailOutput {
	name: string
	mime: string
	/** For markdown / html content embedded in the SPA payload. */
	content?: string
	/** For image / asset urls served by the tunnel. */
	url?: string
}

export interface OutputThumbnailProps {
	output: OutputThumbnailOutput
	/** Side length in pixels. Default 64 — DESIGN-BRIEF Screen 2 spec. */
	size?: number
}

function firstLine(content: string | undefined): string {
	if (!content) return ""
	for (const raw of content.split(/\r?\n/)) {
		const trimmed = raw.trim()
		if (trimmed.length > 0) return trimmed
	}
	return ""
}

function extOf(name: string): string {
	const dot = name.lastIndexOf(".")
	return dot >= 0 ? name.slice(dot + 1).toUpperCase() : ""
}

export function OutputThumbnail({
	output,
	size = 64,
}: OutputThumbnailProps): React.ReactElement {
	const style: CSSProperties = { width: size, height: size }
	const baseClass =
		"flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"

	if (output.mime.startsWith("image/") && output.url) {
		return (
			<div
				data-testid="output-thumbnail"
				data-mime={output.mime}
				className={baseClass}
				style={style}
			>
				<img
					src={output.url}
					alt={output.name}
					loading="lazy"
					decoding="async"
					className="h-full w-full object-cover"
				/>
			</div>
		)
	}

	if (output.mime === "text/html" && output.content) {
		return (
			<div
				data-testid="output-thumbnail"
				data-mime={output.mime}
				className={`${baseClass} pointer-events-none`}
				style={style}
				aria-hidden="true"
			>
				<iframe
					title={`Preview of ${output.name}`}
					srcDoc={output.content}
					sandbox=""
					className="h-full w-full origin-top-left scale-[0.18] border-0"
					style={{ width: `${size / 0.18}px`, height: `${size / 0.18}px` }}
				/>
			</div>
		)
	}

	if (output.mime === "text/markdown" || output.mime === "text/plain") {
		return (
			<div
				data-testid="output-thumbnail"
				data-mime={output.mime}
				className={`${baseClass} px-2`}
				style={style}
			>
				<span className="line-clamp-3 break-words text-center font-mono text-xs leading-tight text-stone-700 dark:text-stone-200">
					{firstLine(output.content) || extOf(output.name) || "TEXT"}
				</span>
			</div>
		)
	}

	return (
		<div
			data-testid="output-thumbnail"
			data-mime={output.mime || "unknown"}
			className={baseClass}
			style={style}
		>
			<span
				aria-hidden="true"
				className="text-xs font-semibold text-stone-600 dark:text-stone-300"
			>
				{extOf(output.name) || "FILE"}
			</span>
		</div>
	)
}
