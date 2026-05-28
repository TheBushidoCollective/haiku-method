// Shared formatting utilities

export function titleCase(s: string): string {
	return s
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
}

export function formatDuration(
	startedAt: string | null,
	completedAt: string | null,
): string {
	if (!startedAt) return ""
	const start = new Date(startedAt).getTime()
	const end = completedAt ? new Date(completedAt).getTime() : Date.now()
	const diffMs = end - start
	const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
	const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
	if (days > 0) return `${days}d ${hours}h`
	if (hours > 0) return `${hours}h`
	const mins = Math.floor(diffMs / (1000 * 60))
	return `${mins}m`
}

/** Format a duration given directly in milliseconds (e.g. summed active time
 *  across iterations). Unlike formatDuration this takes a number, not a span,
 *  and shows minutes alongside hours / seconds for sub-minute totals so a short
 *  active time doesn't collapse to "0m". */
export function formatDurationMs(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return "0s"
	const days = Math.floor(ms / 86400000)
	const hours = Math.floor((ms % 86400000) / 3600000)
	const mins = Math.floor((ms % 3600000) / 60000)
	if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
	if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
	if (mins > 0) return `${mins}m`
	return `${Math.floor(ms / 1000)}s`
}

export function formatDate(iso: string | null): string {
	if (!iso) return ""
	const d = new Date(iso)
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}
