---
title: 'Extract haiku-ui package (React shell, consumes haiku-api)'
type: implementation
depends_on:
  - unit-01-extract-haiku-api-package
  - unit-02-mcp-consume-haiku-api
quality_gates:
  - typecheck
  - test
  - build
inputs:
  - knowledge/ARCHITECTURE.md
status: active
bolt: 1
hat: planner
started_at: '2026-04-21T05:00:32Z'
hat_started_at: '2026-04-21T05:00:32Z'
iterations:
  - hat: planner
    started_at: '2026-04-21T05:00:32Z'
    completed_at: null
    result: null
---
# Extract haiku-ui package

Move `packages/haiku/review-app/` → `packages/haiku-ui/` as its own workspace package. Consume types from `haiku-api`. **No visual change.** This is a pure relocation + dependency rewiring; design-alignment work happens in later units.

## Scope

**New package: `packages/haiku-ui/`**

- Move everything from `packages/haiku/review-app/` → `packages/haiku-ui/`.
- `package.json` — name `haiku-ui`, private workspace, deps: `haiku-api` (workspace), `react`, `react-dom`, `@sentry/react`, `tailwindcss`, current build tools.
- `tsconfig.json`, `vite.config.ts`, `postcss.config.js` — relocated, paths updated.
- `src/` — `main.tsx`, `App.tsx`, `components/`, `hooks/`. `types.ts` replaced with re-exports from `haiku-api`.
- `src/api/client.ts` — single `ApiClient` abstraction wrapping `fetch` + `WebSocket`, typed end-to-end via `haiku-api` route table. Hosts can supply a different client (future extraction hook).
- `src/hooks/useSession.ts`, `useSessionWebSocket.ts` — typed via `haiku-api`. **`useSessionWebSocket` coalesces `session-update` frames via `requestAnimationFrame` batching** — only the most recent payload within a frame applies to React state. Verified by a test that dispatches 100 updates in a tight loop and asserts exactly one React render.
- `README.md` — describes the package as the agent-collaboration UI, documents the backend contract (points to `haiku-api` OpenAPI), shows how to run locally against a mock backend.

**MCP integration:**
- `packages/haiku/scripts/build-review-app.mjs` → `packages/haiku/scripts/bundle-haiku-ui.mjs`. Builds `haiku-ui` (vite), reads `packages/haiku-ui/dist/index.html` + inlines assets into a single HTML blob, writes `packages/haiku/src/haiku-ui-html.ts`.
- `packages/haiku/src/http.ts` `serveSpa()` imports from `./haiku-ui-html` (not `./review-app-html`). Grep for `review-app-html` in `packages/haiku/src/` returns zero after this unit.
- `packages/haiku/package.json` drops `react`, `@sentry/react`, `vite` (now in haiku-ui).
- Remove `packages/haiku/review-app/`.

**Bundle size budget:**
- Inlined `haiku-ui-html.ts` is ≤ 500 KB gzipped. `bundle-haiku-ui.mjs` asserts on write; exits non-zero over budget. Committed baseline at `packages/haiku-ui/budget.json`.

**Byte-identical bundle verification:**
- `packages/haiku/scripts/compare-bundle.mjs` (new) — takes two bundle paths, strips lines matching `/build-timestamp|mtime|sourcemap hash|__vite_\w+/`, diffs the rest. Pre-move bundle snapshot is captured at `stages/development/artifacts/bundle-baseline.html` at the start of this unit.
- Completion requires: `node scripts/compare-bundle.mjs stages/development/artifacts/bundle-baseline.html packages/haiku-ui/dist/index.html` exits 0.

**Runtime DOM parity:**
- Playwright test at `packages/haiku-ui/tests/parity.spec.ts` boots a test MCP against committed fixtures (`packages/haiku-ui/test-fixtures/{review,question,direction}-session.json`), captures the rendered DOM tree for each page, asserts the tree matches committed snapshots at `packages/haiku-ui/tests/__snapshots__/`. Snapshots captured from the pre-move build. Volatile attributes (`data-reactid`, auto-generated id suffixes) stripped via a shared transformer.

## Out of scope

- Any design-alignment work (tokens, components, a11y — later units).
- Changing the routing or page list.
- Changing HTTP response shapes.

## Completion Criteria

- `packages/haiku-ui/` contains the full former `review-app/` code.
- `packages/haiku/review-app/` does not exist.
- Root workspaces include `packages/haiku-ui`.
- `haiku-ui/src/types.ts` re-exports from `haiku-api` (grep for local `export type` or `export interface` in `haiku-ui/src/types.ts` returns zero).
- All components type-check against `haiku-api` schemas — no `any` bridges (grep for `as any` in `haiku-ui/src` returns zero).
- `npm run build -w haiku-ui` produces `dist/index.html` ≤ 500 KB gzipped.
- `npm run build -w haiku` produces the MCP binary with the haiku-ui bundle embedded.
- Bundle comparison script exits 0.
- DOM parity Playwright test passes against all three session fixtures.
- `useSessionWebSocket` rAF coalescing test asserts exactly one React render for 100 burst updates.
- `grep -R review-app-html packages/haiku/src/` returns zero.
- `npx tsc --noEmit` passes.
- `npm test` passes (baseline + new parity tests).
