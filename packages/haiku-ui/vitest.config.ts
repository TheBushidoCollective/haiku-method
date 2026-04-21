import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: false,
		include: [
			"tests/**/*.test.ts",
			"tests/**/*.test.tsx",
			"tests/**/*.spec.ts",
			"tests/**/*.spec.tsx",
		],
	},
})
