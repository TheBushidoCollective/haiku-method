import { readFileSync } from "node:fs"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const pluginVersion = (() => {
	try {
		return JSON.parse(
			readFileSync("../../plugin/.claude-plugin/plugin.json", "utf8"),
		).version
	} catch {
		return "dev"
	}
})()

export default defineConfig({
	plugins: [react(), tailwindcss()],
	define: {
		"import.meta.env.VITE_SENTRY_DSN": JSON.stringify(
			process.env.SENTRY_DSN_REVIEW_SPA || "",
		),
		"import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(
			`haiku-spa@${pluginVersion}`,
		),
	},
	build: {
		// Inline everything into a single HTML file
		minify: false,
		sourcemap: true,
		cssCodeSplit: false,
		assetsInlineLimit: Number.POSITIVE_INFINITY,
		rollupOptions: {
			output: {
				// Single JS bundle
				manualChunks: undefined,
				inlineDynamicImports: true,
			},
		},
	},
})
