"use client"

import { useEffect, useRef } from "react"
import mermaid from "mermaid"

mermaid.initialize({
	startOnLoad: false,
	theme: "base",
	themeVariables: {
		primaryColor: "#f0fdfa",
		primaryBorderColor: "#99f6e4",
		primaryTextColor: "#134e4a",
		lineColor: "#a8a29e",
		secondaryColor: "#faf5ff",
		tertiaryColor: "#f5f5f4",
		fontFamily: "ui-sans-serif, system-ui, sans-serif",
		fontSize: "14px",
	},
})

export function Mermaid({ chart, className }: { chart: string; className?: string }) {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!ref.current) return
		const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
		mermaid.render(id, chart).then(({ svg }) => {
			if (ref.current) {
				ref.current.innerHTML = svg
			}
		})
	}, [chart])

	return <div ref={ref} className={className} />
}
