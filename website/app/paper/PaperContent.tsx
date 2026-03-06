"use client"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import rehypeRaw from "rehype-raw"
import { Mermaid } from "../components/Mermaid"

const components: Components = {
	code({ className, children }) {
		if (className === "language-mermaid") {
			return <Mermaid chart={String(children).trim()} className="my-6" />
		}
		return <code className={className}>{children}</code>
	},
	pre({ children }) {
		// Check if the child is a mermaid code block — if so, render unwrapped
		const child = children as React.ReactElement<{ className?: string }>
		if (child?.props?.className === "language-mermaid") {
			return <>{children}</>
		}
		return <pre>{children}</pre>
	},
}

export function PaperContent({ content }: { content: string }) {
	return (
		<article className="prose prose-stone max-w-none prose-headings:scroll-mt-20 prose-h2:border-t prose-h2:border-stone-200 prose-h2:pt-8 prose-h2:mt-12 prose-a:text-teal-600 hover:prose-a:text-teal-700">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeSlug, rehypeRaw]}
				components={components}
			>
				{content}
			</ReactMarkdown>
		</article>
	)
}
