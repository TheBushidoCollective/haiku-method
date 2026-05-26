// tools/orchestrator/studio-picker-options.ts — Pure shortlist/ordering
// core for the studio picker. Kept in its own leaf module (no imports
// of the tool barrel, runPicker, or the orchestrator) so it's unit-
// testable without dragging the whole tool-registry init chain into the
// test process.

export interface StudioForPicker {
	dir: string
	name: string
	description?: string
}

export interface StudioPickerOption {
	id: string
	label: string
	description: string
	secondary?: boolean
}

/**
 * Order the studio picker so the shortlist renders first — in the
 * caller's declared order, since the agent ranked its candidates most-
 * relevant-first — and flag everything outside it `secondary` (the SPA
 * tucks secondaries behind a "Show all studios…" expansion). The full
 * registry always rides along so narrowing is never lossy. An empty/
 * zero-overlap shortlist → every studio is a primary, in registry order,
 * exactly like the pre-shortlist behavior. `shortlistNames` are canonical
 * studio names (already resolved by the caller); names with no matching
 * studio are ignored.
 */
export function buildStudioPickerOptions(
	allStudios: ReadonlyArray<StudioForPicker>,
	shortlistNames: ReadonlyArray<string>,
): StudioPickerOption[] {
	const byName = new Map(allStudios.map((s) => [s.name, s]))
	const shortlistSet = new Set(shortlistNames)
	// Shortlist in declared order (skip names that match no studio),
	// then every remaining studio in registry order.
	const shortlistStudios: StudioForPicker[] = []
	for (const name of shortlistNames) {
		const s = byName.get(name)
		if (s && !shortlistStudios.includes(s)) shortlistStudios.push(s)
	}
	const ordered = [
		...shortlistStudios,
		...allStudios.filter((s) => !shortlistSet.has(s.name)),
	]
	const hasShortlist = shortlistStudios.length > 0
	return ordered.map((s) => ({
		id: s.dir,
		label: s.name,
		description: s.description ?? "",
		// Only flag secondaries when the shortlist actually matched a
		// studio — otherwise every option is primary (no "Show all" toggle).
		...(hasShortlist && !shortlistSet.has(s.name) ? { secondary: true } : {}),
	}))
}
