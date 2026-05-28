/**
 * AnnotationModeContext — one global "annotation mode" shared by every
 * annotation surface (text-highlight comments, the image pin/pen
 * canvas, and the draw-on-mockup overlay).
 *
 * Before this, each surface decided on its own when to capture input:
 * the highlight surface was always-on (any text selection popped a
 * comment button), the image canvas had its own pin/pen toolbar, and
 * each mockup overlay rendered its own bottom-right pencil FAB — so a
 * page with several mockups stacked several FABs in the same corner.
 *
 * Now there's a single switch with two ways to flip it:
 *   - `pinned`   — the persistent on/off toggled by the global pen FAB.
 *   - `transient`— held only while the Alt/Option key is down, so a
 *                  reviewer can hold ⌥ and drag/select for a quick
 *                  one-off annotation without entering the sticky mode.
 *
 * Surfaces gate their pointer/selection handling on `active`
 * (`pinned || transient`). When it's false they're pointer-transparent
 * and the reviewer interacts with the artifact normally.
 *
 * Default value (no provider mounted): `active: true` — i.e. UNGATED.
 * The gating layer only exists where the provider wraps the tree, so a
 * surface rendered standalone (e.g. a unit test, or an embed that never
 * mounts the provider) keeps its legacy always-available behavior.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react"

export interface AnnotationModeValue {
	/** True when a real provider wraps the consumer. When false, the
	 *  consumer is unwrapped and each surface falls back to its own
	 *  legacy default rather than the gated `active` value. */
	provided: boolean
	/** Persistent mode toggled by the global pen FAB. */
	pinned: boolean
	/** Transient mode held only while Alt/Option is pressed. */
	transient: boolean
	/** Whether annotation surfaces should capture input right now
	 *  (`pinned || transient`). The single value surfaces gate on when a
	 *  provider is present. */
	active: boolean
	/** Flip the persistent (FAB) mode. */
	toggle: () => void
	/** Set the persistent (FAB) mode explicitly. */
	setPinned: (on: boolean) => void
}

// No-provider default. `provided: false` tells each surface to keep its
// own legacy ungated behavior (the highlight + image canvas were always
// available; the mockup overlay was off until toggled) rather than
// reading `active`. In the real app the root mounts the provider, so
// `provided` is true everywhere and `active` governs.
const UNPROVIDED_DEFAULT: AnnotationModeValue = {
	provided: false,
	pinned: false,
	transient: false,
	active: false,
	toggle: () => {},
	setPinned: () => {},
}

const AnnotationModeContext =
	createContext<AnnotationModeValue>(UNPROVIDED_DEFAULT)

export function AnnotationModeProvider({
	children,
}: {
	children: React.ReactNode
}): React.ReactElement {
	const [pinned, setPinned] = useState(false)
	const [transient, setTransient] = useState(false)

	// Alt/Option held → transient annotation mode. We track the lone Alt
	// keydown/keyup rather than reading `event.altKey` off other events so
	// the mode tracks the physical key, not whatever modifier rides along
	// with an unrelated keystroke. `blur` + `visibilitychange` clear the
	// flag so it never sticks "on" if the key is released while the tab
	// is backgrounded (the keyup would otherwise land on another window).
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent): void {
			if (event.key === "Alt") setTransient(true)
		}
		function onKeyUp(event: KeyboardEvent): void {
			if (event.key === "Alt") setTransient(false)
		}
		function clearTransient(): void {
			setTransient(false)
		}
		window.addEventListener("keydown", onKeyDown)
		window.addEventListener("keyup", onKeyUp)
		window.addEventListener("blur", clearTransient)
		document.addEventListener("visibilitychange", clearTransient)
		return () => {
			window.removeEventListener("keydown", onKeyDown)
			window.removeEventListener("keyup", onKeyUp)
			window.removeEventListener("blur", clearTransient)
			document.removeEventListener("visibilitychange", clearTransient)
		}
	}, [])

	const toggle = useCallback(() => {
		setPinned((prev) => !prev)
	}, [])

	const value = useMemo<AnnotationModeValue>(
		() => ({
			provided: true,
			pinned,
			transient,
			active: pinned || transient,
			toggle,
			setPinned,
		}),
		[pinned, transient, toggle],
	)

	return (
		<AnnotationModeContext.Provider value={value}>
			{children}
		</AnnotationModeContext.Provider>
	)
}

/**
 * Read the shared annotation mode. Never throws — outside a provider it
 * returns the unprovided default (`provided: false`), and each surface
 * decides its own ungated fallback. Inside a provider, `active` reflects
 * the FAB toggle and the held-Alt gesture.
 */
export function useAnnotationMode(): AnnotationModeValue {
	return useContext(AnnotationModeContext)
}
