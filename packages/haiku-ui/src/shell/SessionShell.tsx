/**
 * SessionShell — full-bleed shell for question + design-direction pages.
 *
 * Mirrors the review-page chrome (`pages/review/ReviewPage.tsx`):
 *   - H·AI·K·U brand wordmark + page-kind label + (optional) session title
 *   - ThemeToggle on the right
 *   - Sticky header with backdrop blur
 *   - Main content fills the viewport, scrolls within itself
 *   - No "Powered by" footer — matches review's chrome (the legacy
 *     ShellLayout footer was carried over from the old session pages
 *     and felt out of place once the rest of the chrome aligned).
 *
 * Deliberately lighter than ReviewPage: no StageProgressStrip, no
 * FeedbackSidebar — those belong to the review surface only. Question
 * and direction sessions are single-purpose blocking interactions.
 */

import { Header as HeaderLandmark, Main } from "../a11y"
import { ThemeToggle } from "../atoms/ThemeToggle"
import { AnnotationModeFab } from "../organisms/AnnotationModeFab"

export interface SessionShellProps {
	/** Page-kind label rendered after the brand wordmark (e.g. "Question",
	 *  "Design Direction"). */
	kind: string
	/** Optional title shown after the kind label — typically the question
	 *  prompt or design-direction title. */
	title?: string
	/** When true, mount the global annotation pen FAB. Set on surfaces
	 *  that render annotatable artifacts (question, design-direction);
	 *  left off for read-only shells (picker, view). */
	annotatable?: boolean
	children: React.ReactNode
}

export function SessionShell({
	kind,
	title,
	annotatable = false,
	children,
}: SessionShellProps): React.ReactElement {
	return (
		<div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
			<HeaderLandmark className="shrink-0 z-40 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm border-b border-stone-200 dark:border-stone-800">
				<div className="px-4 sm:px-6 py-3 flex items-center justify-between">
					<div className="flex items-center gap-3 min-w-0">
						<span className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-100">
							H·AI·K·U
						</span>
						<span className="text-stone-300 dark:text-stone-600">|</span>
						<span className="text-sm font-medium text-stone-500 dark:text-stone-400">
							{kind}
						</span>
						{title && (
							<>
								<span className="text-stone-300 dark:text-stone-600">/</span>
								<span className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
									{title}
								</span>
							</>
						)}
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<ThemeToggle />
					</div>
				</div>
			</HeaderLandmark>
			<Main
				ariaLabel={`${kind} content`}
				className="flex-1 min-w-0 overflow-y-auto"
			>
				<div className="max-w-[var(--content-max)] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
					{children}
				</div>
			</Main>
			{annotatable && <AnnotationModeFab />}
		</div>
	)
}
