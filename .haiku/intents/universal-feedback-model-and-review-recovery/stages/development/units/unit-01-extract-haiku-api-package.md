---
title: Extract haiku-api package (Zod schemas + OpenAPI emission)
type: implementation
depends_on: []
quality_gates:
  - typecheck
  - test
  - build
inputs:
  - intent.md
  - stages/development/state.json
  - knowledge/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
status: pending
bolt: 0
hat: ""
---

# Extract haiku-api package

Create a new `packages/haiku-api/` workspace package that owns the HTTP + WebSocket contract shared by the MCP backend and the agent-collab UI. Zod is the source of truth; OpenAPI is emitted at build time for external consumers.

## Scope

**New package: `packages/haiku-api/`**

- `package.json` — private workspace package, name `haiku-api` (unscoped, matching root-level npm convention).
- `tsconfig.json` — extends repo base, emits `.d.ts`.
- `src/index.ts` — barrel export for every schema + route constant + WebSocket envelope.
- `src/schemas/` — one file per route group:
  - `session.ts` — `SessionPayload`, `ReviewSession`, `QuestionSession`, `DirectionSession`, `ReviewCurrentPayload`, `HeartbeatResponse`
  - `review.ts` — `ReviewDecisionRequest`, `ReviewDecisionResponse`
  - `direction.ts` — `DirectionSelectRequest`, `DirectionSelectResponse`
  - `question.ts` — `QuestionAnswerRequest`, `QuestionAnswerResponse`
  - `feedback.ts` — `FeedbackItem`, `FeedbackListResponse`, `FeedbackCreateRequest`, `FeedbackUpdateRequest`, `FeedbackDeleteResponse`
  - `files.ts` — `FileServeRequest` (path + session id params only; responses are raw streams)
  - `websocket.ts` — `WsClientMessage` (decision | direction-select | answer) + `WsServerMessage` (session-update | ack | error)
- `src/routes.ts` — typed route table: path templates, methods, request/response schema refs. Derive path constants: `routes.session(id)`, `routes.review(id)`, etc.
- `src/openapi.ts` — build helper that combines schemas + routes into an OpenAPI 3.1 document.
- `scripts/emit-openapi.mjs` — runs at build time to produce `dist/openapi.json`.
- `README.md` — explains package purpose, schema organization, how to regenerate OpenAPI, how external consumers can use the spec.

**Source migration:**
- Move types from `packages/haiku/review-app/src/types.ts` into Zod schemas under `haiku-api/src/schemas/`. Keep the TS types exported (inferred from Zod).
- Extract session/review/direction/question payload shapes currently hand-maintained in `packages/haiku/src/http.ts` into Zod schemas under `haiku-api/src/schemas/` so the backend can validate against them.

**Root `package.json` update:**
- Add `packages/haiku-api` to workspaces.
- No dependency changes on other packages in this unit — that happens in unit-02.

## Out of scope

- Refactoring MCP to consume the package (unit-02).
- Refactoring review-app / UI (unit-03+).

## Completion Criteria

- `packages/haiku-api/` exists with the structure above.
- Every HTTP route served by `packages/haiku/src/http.ts` has a matching Zod schema (request + response) in `haiku-api/src/schemas/`.
- Every WebSocket message handled by `handleWebSocketMessage` has a matching envelope in `websocket.ts`.
- `npm run build -w haiku-api` emits `dist/openapi.json` with paths, components, and operationIds matching the current HTTP surface.
- `npm run test -w haiku-api` runs a schema round-trip test (parse valid + reject invalid) for every schema.
- `npx tsc --noEmit` passes at the repo root.
- Biome lints cleanly on the new package.
