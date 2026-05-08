import type { ReactNode } from "react"

interface TickSequenceProps {
	title?: string
	caption?: string
	children: ReactNode
}

export function TickSequence({ title, caption, children }: TickSequenceProps) {
	return (
		<div className="not-prose my-6">
			{title ? (
				<div className="mb-1 font-mono text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
					{title}
				</div>
			) : null}
			{caption ? (
				<div className="mb-3 text-sm text-stone-600 dark:text-stone-400">
					{caption}
				</div>
			) : null}
			<div className="flex flex-col gap-3">{children}</div>
		</div>
	)
}

interface TickCardProps {
	n: number | string
	title: string
	action?: string
	dispatch?: string
	children: ReactNode
}

export function TickCard({
	n,
	title,
	action,
	dispatch,
	children,
}: TickCardProps) {
	return (
		<div className="rounded-lg border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
			<div className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2.5 dark:border-stone-800 dark:bg-stone-900/60">
				<span className="flex h-7 min-w-[2.25rem] items-center justify-center rounded-full bg-stone-900 px-2 font-mono text-xs font-semibold text-white dark:bg-stone-700">
					{typeof n === "number" ? `tick ${n}` : n}
				</span>
				<span className="font-semibold text-stone-900 dark:text-white">
					{title}
				</span>
			</div>
			<div className="space-y-3 px-4 py-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
				{children}
				{action || dispatch ? (
					<div className="flex flex-col gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
						{action ? (
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-500">
									Cursor returns
								</span>
								<code className="rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 font-mono text-xs text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
									{action}
								</code>
							</div>
						) : null}
						{dispatch ? (
							<div className="flex flex-wrap items-start gap-2">
								<span className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-500">
									Agent does
								</span>
								<span className="text-sm text-stone-700 dark:text-stone-300">
									{dispatch}
								</span>
							</div>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	)
}
