---
title: Extract haiku-ui package (React shell, consumes haiku-api)
type: implementation
depends_on:
  - unit-01-extract-haiku-api-package
  - unit-02-mcp-consume-haiku-api
quality_gates:
  - typecheck
  - test
  - build
inputs:
  - stages/development/state.json
status: pending
bolt: 0
hat: ""
---

# Extract haiku-ui package

Move `packages/haiku/review-app/` to `packages/haiku-ui/` as its own workspace package. Consume types from `haiku-api`. No visual change yet — this is a pure relocation + dependency rewiring. The feature work (design alignment) happens in later units.

## Scope

**New package: `packages/haiku-ui/`**

- Move everything from `packages/haiku/review-app/` → `packages/haiku-ui/`.
- `package.json` — name `haiku-ui`, private workspace, deps: `haiku-api` (workspace), `react`, `react-dom`, `@sentry/react`, `tailwindcss`, build tools currently in haiku.
- `tsconfig.json`, `vite.config.ts`, `postcss.config.js` — relocated, paths updated for new root.
- `src/` — `main.tsx`, `App.tsx`, `components/`, `hooks/`, `types.ts` replaced with re-exports from `haiku-api`.
- `README.md` — describes the package as the agent-collaboration UI, documents the backend contract (points to `haiku-api` OpenAPI), explains how to run locally against a mock backend.

**Consumption layer:**
- `useSession`, `useSessionWebSocket` hooks in `src/hooks/` typed against `haiku-api` schemas.
- Replace every type import from local `types.ts` with import from `haiku-api`.
- An `ApiClient` abstraction in `src/api/client.ts` wrapping `fetch` + `WebSocket`, typed end-to-end via `haiku-api` route table. Host apps can supply a different client if they need to (future extraction hook).

**MCP integration:**
- `packages/haiku/scripts/build-review-app.mjs` replaced with `packages/haiku/scripts/bundle-haiku-ui.mjs`:
  - Builds `haiku-ui` (runs its vite build).
  - Reads `packages/haiku-ui/dist/index.html` (and assets).
  - Inlines assets into a single HTML blob.
  - Writes `packages/haiku/src/haiku-ui-html.ts` (renamed from `review-app-html.ts`).
- `packages/haiku/src/http.ts` `serveSpa()` serves the new bundle.
- `packages/haiku/package.json` drops `haiku-ui`'s direct deps (react, @sentry/react, vite) — they move to the new package.
- Remove `packages/haiku/review-app/` (now empty).

## Out of scope

- Any design-alignment work (tokens, components, a11y, etc. — later units).
- Changing the routing / page list.
- Changing the MCP's HTTP response shape for `/review/:id` etc.

## Completion Criteria

- `packages/haiku-ui/` contains the full former `review-app/` codebase.
- `packages/haiku/review-app/` does not exist.
- Root workspaces config includes `packages/haiku-ui`.
- `haiku-ui/src/types.ts` re-exports from `haiku-api` (no duplicate type defs).
- All components type-check against `haiku-api` schemas — no `any` bridges.
- `npm run build -w haiku-ui` produces `dist/index.html` with all assets inlined (matches prior single-file output pattern).
- `npm run build -w haiku` produces the MCP binary with the haiku-ui bundle embedded; serving `/review/current` returns the same HTML bytes (byte-for-byte comparison acceptable allowing build-timestamp differences).
- The existing review-pane, question, and direction flows work end-to-end against a running MCP with no visible or behavioral change.
- `npx tsc --noEmit` passes across the workspace.
- `npm test` passes.
