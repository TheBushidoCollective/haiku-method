---
title: MCP consumes haiku-api (route validation + shared types)
type: implementation
depends_on:
  - unit-01-extract-haiku-api-package
quality_gates:
  - typecheck
  - test
inputs:
  - stages/development/state.json
status: pending
bolt: 0
hat: ""
---

# MCP consumes haiku-api

Refactor `packages/haiku/src/http.ts` to use `haiku-api` schemas for request validation and response shaping. No user-visible behavior change — every endpoint returns the same payload, but the types now come from one source.

## Scope

- Add `haiku-api` as a workspace dep in `packages/haiku/package.json`.
- Import schemas from `haiku-api` at every route handler in `http.ts`:
  - `handleSessionApi` returns `SessionPayload`
  - `handleReviewGet`, `handleDecidePost` validate against review schemas
  - `handleDirectionGet`, `handleDirectionSelectPost` validate against direction schemas
  - `handleQuestionGet`, `handleQuestionAnswerPost` validate against question schemas
  - `handleFeedbackGet/Post/Put/Delete` validate against feedback schemas
  - `handleReviewCurrent` returns `ReviewCurrentPayload`
  - WebSocket `handleWebSocketMessage` parses incoming frames as `WsClientMessage`, emits `WsServerMessage`.
- Replace ad-hoc request-body parsing with `schema.safeParse(...)` + uniform 400 on parse failure.
- Replace inline type literals in responses with schema-inferred types.
- Delete now-duplicate type declarations local to `http.ts`.

## Out of scope

- Changing any route's behavior or response shape.
- Review-app refactor (unit-03+).

## Completion Criteria

- Every HTTP handler in `http.ts` imports its request/response schema from `haiku-api`.
- Every handler validates the request body/query/path params with Zod and returns a typed 400 on validation failure (with `{ error, issues }` in the body).
- WebSocket frames are parsed/stringified via `haiku-api` envelope schemas.
- The existing integration tests (`http-feedback.test.mjs`, `external-review.test.mjs`, `server-tools.test.mjs`) still pass untouched.
- Zero new types declared in `http.ts` — everything flows from `haiku-api`.
- `npx tsc --noEmit` passes.
- `npm test` passes (487+ baseline, zero regressions).
