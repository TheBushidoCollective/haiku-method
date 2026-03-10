"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const navItems = [
	{ label: "Methodology", href: "/methodology" },
	{ label: "Phases", href: "/phases/elaboration" },
	{ label: "Profiles", href: "/profiles" },
	{ label: "Getting Started", href: "/getting-started" },
	{ label: "Paper", href: "/paper" },
]

export function Header() {
	const pathname = usePathname()
	const [mobileOpen, setMobileOpen] = useState(false)

	const isActive = (href: string) => {
		if (href === "/phases/elaboration") {
			return pathname.startsWith("/phases")
		}
		return pathname === href || pathname.startsWith(href + "/")
	}

	return (
		<header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
			<nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
				<Link
					href="/"
					className="text-xl font-semibold tracking-tight text-stone-900"
				>
					<span className="text-teal-600">H</span>
					<span className="text-stone-300">&middot;</span>
					<span className="text-teal-600">AI</span>
					<span className="text-stone-300">&middot;</span>
					<span className="text-teal-600">K</span>
					<span className="text-stone-300">&middot;</span>
					<span className="text-teal-600">U</span>
				</Link>

				{/* Desktop nav */}
				<div className="hidden items-center gap-1 md:flex">
					{navItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className={`rounded-lg px-3 py-2 text-sm transition ${
								isActive(item.href)
									? "bg-stone-100 font-medium text-stone-900"
									: "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
							}`}
						>
							{item.label}
						</Link>
					))}
					<a
						href="https://github.com/TheBushidoCollective/haiku-method"
						target="_blank"
						rel="noopener noreferrer"
						className="ml-2 rounded-lg p-2 text-stone-400 transition hover:bg-stone-50 hover:text-stone-900"
						aria-label="GitHub"
					>
						<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
						</svg>
					</a>
				</div>

				{/* Mobile menu button */}
				<button
					type="button"
					className="rounded-lg p-2 text-stone-500 hover:bg-stone-50 md:hidden"
					onClick={() => setMobileOpen(!mobileOpen)}
					aria-label="Toggle menu"
				>
					<svg
						className="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						{mobileOpen ? (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						) : (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 6h16M4 12h16M4 18h16"
							/>
						)}
					</svg>
				</button>
			</nav>

			{/* Mobile nav */}
			{mobileOpen && (
				<div className="border-t border-stone-200 bg-white px-4 py-4 md:hidden">
					{navItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							onClick={() => setMobileOpen(false)}
							className={`block rounded-lg px-3 py-2 text-sm ${
								isActive(item.href)
									? "bg-stone-100 font-medium text-stone-900"
									: "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
							}`}
						>
							{item.label}
						</Link>
					))}
				</div>
			)}
		</header>
	)
}
