import * as Sentry from "@sentry/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ApiClientProvider } from "./api/context"
import "./index.css"
import { App } from "./App"

// Initialize Sentry — DSN is baked in at build time via Vite's define config
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,
		release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
		tracesSampleRate: 0.1,
		replaysSessionSampleRate: 0,
		replaysOnErrorSampleRate: 1.0,
	})
}

// Theme bootstrap lives in two places now:
//   - Synchronously in `index.html`'s <head> to prevent FOUC.
//   - Reactively in `App.tsx`'s mount useEffect (matchMedia listener + React
//     state sync via <ThemeToggle/>).
// Keeping it out of main.tsx avoids a three-way race when the stored value
// and the system preference disagree.

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element — check index.html")
createRoot(root).render(
	<StrictMode>
		<ApiClientProvider>
			<App />
		</ApiClientProvider>
	</StrictMode>,
)
