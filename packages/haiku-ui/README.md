# haiku-ui

The H·AI·K·U agent-collaboration UI — a React SPA that hosts review, question,
and design-direction sessions for human reviewers.

Hosts run this package two ways:

- **Development** — `npm run dev -w haiku-ui` starts the Vite dev server on
  `:5173`. Point it at a running H·AI·K·U MCP (defaults assume the MCP is on
  `:7777`; override with standard Vite proxy config if needed).
- **Production** — `packages/haiku/scripts/bundle-haiku-ui.mjs` builds this
  package with Vite, inlines every asset into a single HTML blob, and writes
  the result as a TypeScript string constant consumed by the MCP HTTP server.
  The MCP binary ships the SPA embedded; no separate static-file step.

## Backend contract

All HTTP and WebSocket payloads are typed against `haiku-api`. There are zero
local wire-type declarations in this package — `src/types.ts` re-exports from
`haiku-api` and `@haiku/shared`.

See `packages/haiku-api/` for the OpenAPI route table and Zod schemas. The
`ApiClient` abstraction in `src/api/client.ts` is the single seam that wraps
`fetch` + `WebSocket`; hosts can supply an alternative client via
`<ApiClientProvider>` for mocked or embedded scenarios.

## WebSocket batching

`useSessionWebSocket` coalesces `session-update` frames via
`requestAnimationFrame`: bursty WS traffic (up to hundreds of frames per
second) collapses to one React render per animation frame. See
`tests/use-session-websocket.test.tsx` for the coverage (100 frames → 1
render).

## Running locally against a mock backend

```sh
# 1) run the MCP (bundles this package and serves it on :7777):
npm run build -w haiku
node ../haiku/plugin/bin/haiku --http 7777

# 2) in a second terminal, run this package's dev server (hot reload):
npm run dev -w haiku-ui
```

The dev server proxies to `:7777` by default. For pure-UI work without a
backend, stub `ApiClient` via the provider and feed it fixture data from
`test-fixtures/`.

## Tests

- `vitest` — unit tests (rAF coalescing, misc hooks).
- `playwright` — DOM-parity tests that boot the app against committed
  fixtures and assert tree equivalence against `tests/__snapshots__/`.
