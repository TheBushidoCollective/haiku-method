/**
 * Application shell — theme init, landmark composition, route parse, live-
 * region mounts. No page-specific JSX.
 *
 * DOM order per `stages/design/artifacts/aria-landmark-spec.md §1`:
 *   1. <SkipLink>              — first focusable; target is <Main id="main-content">
 *   2. <Header role="banner">  — via Header component + HeaderLandmark primitive
 *   3. <Main role="main">      — id="main-content", tabIndex={-1}
 *   4. <FooterBar>             — role="contentinfo"
 *   5. <LiveRegionShell>       — two sr-only live regions (polite + assertive)
 *
 * See `stages/development/artifacts/unit-06-tactical-plan.md` for scope +
 * hard gates (App.tsx < 100 lines, no page-specific JSX).
 */

import { useEffect } from "react"
import { LiveRegionShell } from "./a11y"
import { SkipLink } from "./components/SkipLink"
import {
	DirectionPageModule,
	QuestionPageModule,
	ReviewCurrentPageModule,
	ReviewPageModule,
} from "./pages"
import { parseRoute, type ParsedRoute } from "./routing/parseRoute"
import { NotFoundShell, ShellLayout } from "./shell/ShellLayout"
import { applyThemePreference, THEME_KEY } from "./theme"

export function App(): React.ReactElement {
	useEffect(() => {
		applyThemePreference()
		const mql = window.matchMedia("(prefers-color-scheme: dark)")
		const onChange = () => {
			if (!window.localStorage.getItem(THEME_KEY)) applyThemePreference()
		}
		mql.addEventListener("change", onChange)
		return () => mql.removeEventListener("change", onChange)
	}, [])
	const route = parseRoute()
	return (
		<>
			<SkipLink />
			{route ? <RoutedApp route={route} /> : <NotFoundShell />}
			<LiveRegionShell />
		</>
	)
}

function RoutedApp({ route }: { route: ParsedRoute }): React.ReactElement {
	switch (route.pageType) {
		case "review":
			return (
				<ShellLayout title="Review">
					<ReviewPageModule sessionId={route.sessionId} />
				</ShellLayout>
			)
		case "review-current":
			return (
				<ShellLayout title="Review">
					<ReviewCurrentPageModule />
				</ShellLayout>
			)
		case "question":
			return (
				<ShellLayout title="Question">
					<QuestionPageModule sessionId={route.sessionId} />
				</ShellLayout>
			)
		case "direction":
			return (
				<ShellLayout title="Design Direction">
					<DirectionPageModule sessionId={route.sessionId} />
				</ShellLayout>
			)
	}
}
