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
outputs:
  - packages/haiku-api/package.json
  - packages/haiku-api/tsconfig.json
  - packages/haiku-api/README.md
  - packages/haiku-api/src/index.ts
  - packages/haiku-api/src/version.ts
  - packages/haiku-api/src/routes.ts
  - packages/haiku-api/src/openapi.ts
  - packages/haiku-api/src/schemas/common.ts
  - packages/haiku-api/src/schemas/review.ts
  - packages/haiku-api/src/schemas/direction.ts
  - packages/haiku-api/src/schemas/question.ts
  - packages/haiku-api/src/schemas/feedback.ts
  - packages/haiku-api/src/schemas/files.ts
  - packages/haiku-api/src/schemas/session.ts
  - packages/haiku-api/src/schemas/websocket.ts
  - packages/haiku-api/scripts/emit-openapi.mjs
  - packages/haiku-api/test/run-all.mjs
  - packages/haiku-api/test/helpers.mjs
  - packages/haiku-api/test/schemas.test.mjs
  - packages/haiku-api/test/routes.test.mjs
  - packages/haiku-api/test/openapi.test.mjs
  - package.json
  - package-lock.json
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

## References

- Unit spec (this file) and acceptance criteria in `.haiku/intents/universal-feedback-model-and-review-recovery/knowledge/ACCEPTANCE-CRITERIA.md`
- `packages/haiku/src/http.ts` — HTTP + WebSocket surface to extract schemas from (lines 138–198 for /review/decide, 503–610 for question/direction, 723–784 for WS envelope, 902–1238 for /api/feedback CRUD, 1242–1374 for /api/review/current, 1376–1520 for route table).
- `packages/haiku/src/sessions.ts` — authoritative session TypeScript shapes (ReviewSession, QuestionSession, DesignDirectionSession, ReviewAnnotations, QuestionAnnotations, QuestionAnswer).
- `packages/haiku/src/state-tools.ts` — FEEDBACK_ORIGINS, FEEDBACK_STATUSES, FeedbackItem interface (lines 2907–3039).
- `packages/haiku/review-app/src/types.ts` — existing client-side TS types (FeedbackItemData, SessionData, ReviewCurrentResponse, etc.) to replace by Zod-inferred types.

## Plan

### Approach

Stand up a new private workspace package `packages/haiku-api` that owns the HTTP + WebSocket contract as Zod schemas. Zod is the source of truth; TypeScript types are inferred via `z.infer<>`; OpenAPI 3.1 is emitted at build time. The package is source-only in this unit — no downstream consumer refactoring (that's unit-02+).

The existing `packages/haiku/src/http.ts` hand-validates requests via inline Zod schemas. We lift those inline schemas into `haiku-api/src/schemas/*.ts`, add the response envelope schemas (currently only TS types in `review-app/src/types.ts`), and expose a route table so both the server and the SPA can reference the same contract. Zod round-trip tests lock the schemas; the OpenAPI emitter walks the route table + schema registry.

### Files to create

1. **`packages/haiku-api/package.json`** — name `haiku-api`, private, `"type": "module"`, `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`, plus `"exports"` map (`.` and `./openapi.json`). Scripts: `build` (tsc + emit-openapi), `test` (tsx runner over `test/*.test.mjs`), `typecheck` (tsc --noEmit). Dependencies: `zod` (match root `^3.23.0`), dev `typescript`, `tsx`, `@types/node`, `zod-to-json-schema` for OpenAPI emission.
2. **`packages/haiku-api/tsconfig.json`** — target ES2022, module NodeNext, strict, `declaration: true`, `outDir: dist`, `rootDir: src`. Not extending a root base (no root tsconfig exists in this repo), but mirror the `packages/haiku/tsconfig.json` shape exactly for consistency.
3. **`packages/haiku-api/src/index.ts`** — barrel export for every schema file + `routes` + `paths` constants + the OpenAPI builder.
4. **`packages/haiku-api/src/schemas/common.ts`** — shared primitives: `FeedbackOriginSchema` (z.enum literal mirror of `state-tools.FEEDBACK_ORIGINS`), `FeedbackStatusSchema`, `PinSchema`, `InlineCommentSchema`, `ReviewAnnotationsSchema`, `QuestionAnnotationsSchema`.
5. **`packages/haiku-api/src/schemas/session.ts`** — `SessionTypeSchema` (`"review" | "question" | "design_direction"`), `SessionStatusSchema`, `ReviewSessionPayloadSchema`, `QuestionSessionPayloadSchema`, `DirectionSessionPayloadSchema`, discriminated-union `SessionPayloadSchema` (matches `handleSessionApi` response), `ReviewCurrentPayloadSchema` (matches `handleReviewCurrent`), `HeartbeatResponseSchema` (empty object / 200|404).
6. **`packages/haiku-api/src/schemas/review.ts`** — `ReviewDecisionRequestSchema` (mirror of `DecideSchema` at http.ts:153), `ReviewDecisionResponseSchema` (`{ ok: true, decision, feedback }`).
7. **`packages/haiku-api/src/schemas/direction.ts`** — `DirectionSelectRequestSchema` (mirror of `DirectionSelectSchema` at http.ts:595), `DirectionSelectResponseSchema`.
8. **`packages/haiku-api/src/schemas/question.ts`** — `QuestionAnswerRequestSchema` (mirror of `QuestionAnswerSchema` at http.ts:527), `QuestionAnswerResponseSchema`.
9. **`packages/haiku-api/src/schemas/feedback.ts`** — `FeedbackItemSchema` (mirror of `state-tools.FeedbackItem` renamed for API: `feedback_id` aliased from `id`, `closed_by`, etc.), `FeedbackListResponseSchema`, `FeedbackCreateRequestSchema` (mirror of `FeedbackCreateSchema` at http.ts:990), `FeedbackCreateResponseSchema`, `FeedbackUpdateRequestSchema` (mirror of `FeedbackUpdateSchema` at http.ts:1074), `FeedbackUpdateResponseSchema`, `FeedbackDeleteResponseSchema`.
10. **`packages/haiku-api/src/schemas/files.ts`** — `FileServeParamsSchema` (sessionId + path).
11. **`packages/haiku-api/src/schemas/websocket.ts`** — discriminated unions: `WsClientMessageSchema` = `{type: "decide", ...ReviewDecisionRequest}` | `{type: "answer", ...QuestionAnswerRequest}` | `{type: "select", archetype, parameters, comments?, annotations?}`; `WsServerMessageSchema` = `{type: "session-update", ...}` | `{type: "ack", ok: true, ...}` | `{type: "error", error: string}`.
12. **`packages/haiku-api/src/routes.ts`** — `paths` object with path-builder functions (`paths.session(id)`, `paths.reviewDecide(id)`, `paths.feedbackList(intent, stage)`, etc.), plus `routes` array entries: `{ method, pathTemplate, operationId, request, response, summary }`.
13. **`packages/haiku-api/src/openapi.ts`** — `buildOpenApi()` function: walks `routes`, uses `zod-to-json-schema` to convert each request/response Zod schema into JSON schema, registers them under `components.schemas`, emits OpenAPI 3.1 doc with `paths`, `components`, `operationIds`.
14. **`packages/haiku-api/scripts/emit-openapi.mjs`** — tsx script that imports the built `dist/openapi.js` (or the source via tsx), calls `buildOpenApi()`, writes `dist/openapi.json`. Invoked by the `build` npm script after tsc.
15. **`packages/haiku-api/test/schemas.test.mjs`** — one describe block per schema file. Each schema gets a "parses valid" case and a "rejects invalid" case. Uses Node's `node:assert`.
16. **`packages/haiku-api/test/routes.test.mjs`** — asserts every concrete HTTP handler in `packages/haiku/src/http.ts` (regexp match list, not import) has a corresponding entry in `routes.ts`. Uses `readFileSync` on `http.ts` + a grep for `path.match(...)` blocks.
17. **`packages/haiku-api/test/openapi.test.mjs`** — calls `buildOpenApi()`, asserts `openapi === "3.1.0"`, `paths` contains every expected path, `components.schemas` is non-empty, every path has an `operationId`.
18. **`packages/haiku-api/README.md`** — purpose, schema organization, regenerate OpenAPI, external consumer usage (`import { routes, FeedbackItemSchema } from "haiku-api"` once consumed, or read `dist/openapi.json` externally).

### Files to modify

- **`package.json` (root)** — add `"packages/haiku-api"` to `workspaces` array. No other dependency changes (per spec: "no dependency changes on other packages in this unit — that happens in unit-02").

### Implementation steps

1. Create `packages/haiku-api/` directory tree; stub `package.json`, `tsconfig.json`, `README.md`.
2. Add `"packages/haiku-api"` to root `package.json` workspaces; run `npm install --workspaces` to link the workspace and install `zod` + dev deps.
3. Implement `src/schemas/common.ts` first (shared primitives referenced by every other schema).
4. Implement the per-route-group schemas in dependency order: `review.ts`, `direction.ts`, `question.ts`, `feedback.ts`, `files.ts`, `session.ts`, `websocket.ts`. Each schema: (a) mirror the shape currently in `http.ts` or `sessions.ts`/`types.ts` exactly, (b) export `z.infer<typeof XSchema>` as `X` type, (c) include `.describe()` calls on fields that will surface in OpenAPI.
5. Implement `src/routes.ts` — enumerate every route handled in `http.ts` `handleRequest` (lines 1376–1520): GET `/api/session/:id`, HEAD `/api/session/:id/heartbeat`, GET `/review/current`, GET `/review/:id`, POST `/review/:id/decide`, GET `/mockups/:id/:path`, GET `/wireframe/:id/:path`, GET `/stage-artifacts/:id/:path`, GET `/direction/:id`, POST `/direction/:id/select`, GET `/question-image/:id/:index`, GET `/question/:id`, POST `/question/:id/answer`, GET `/api/review/current`, GET `/api/feedback/:intent/:stage`, POST `/api/feedback/:intent/:stage`, PUT `/api/feedback/:intent/:stage/:id`, DELETE `/api/feedback/:intent/:stage/:id`, GET `/files/:id/:path`, GET `/health`, plus the WS upgrade path `/ws/session/:id`.
6. Implement `src/openapi.ts` using `zod-to-json-schema` to build the `components.schemas` bag; walk `routes` to build `paths`. OpenAPI 3.1 `info.title = "H·AI·K·U Review API"`, `info.version` = `haiku-api` package.json version.
7. Implement `src/index.ts` barrel.
8. Implement `scripts/emit-openapi.mjs` — imports from `dist/` (since build script chains `tsc` then the emitter).
9. Add tests (`test/schemas.test.mjs`, `test/routes.test.mjs`, `test/openapi.test.mjs`). Every schema exports both parse-valid and reject-invalid coverage.
10. Wire `package.json` scripts: `"build": "tsc && node scripts/emit-openapi.mjs"`, `"test": "tsx --test test/*.test.mjs"` (Node built-in test runner works here since we only need assert + describe-free style; fall back to a manual `run-all.mjs` if needed to match `packages/haiku/test/run-all.mjs` pattern).
11. Run `npx tsc --noEmit` at repo root (i.e. inside `packages/haiku-api`), fix any strict-mode type errors.
12. Run `npx biome check packages/haiku-api` — expect no lint errors (biome.json already globs `packages/**`).
13. Run `npm run test -w haiku-api` and `npm run build -w haiku-api` — both must exit 0 and the build must produce `dist/openapi.json`.

### Verification commands

Run from the unit worktree root:

```bash
# Typecheck just this package
npx tsc --noEmit -p packages/haiku-api/tsconfig.json

# Typecheck the whole repo (per completion criteria)
cd packages/haiku && npx tsc --noEmit

# Build emits openapi.json
npm run build -w haiku-api
test -f packages/haiku-api/dist/openapi.json

# Tests
npm run test -w haiku-api

# Lint
npx biome check packages/haiku-api
```

### Test coverage (BDD alignment)

The product stage ships `.feature` files under `.haiku/intents/.../features/` covering system behavior: `additive-elaborate`, `auto-revisit`, `enforce-iteration-fix`, `external-review-feedback`, `feedback-crud`, `review-ui-feedback`, `revisit-with-reasons`. These scenarios exercise the **backend orchestrator and HTTP handler behavior**, which unit-01 does NOT implement — that's unit-02+ (MCP consumes the package) and unit-03+ (review-app consumes it).

What unit-01 owns from the BDD surface is the **shape of the wire contract** those scenarios cross. So the unit-01 test plan covers the schema contract, and the downstream units (02+) will wire the scenarios end-to-end:

- `test/schemas.test.mjs` — one "parses valid" + one "rejects invalid" case per exported Zod schema (~20 schemas → 40+ assertions). Each test group includes a comment header referencing the `.feature` file(s) that traverse that schema on the wire (e.g. `// Traversed by: feedback-crud.feature, review-ui-feedback.feature`). This gives unit-02+ a direct mapping when wiring step definitions.
- `test/routes.test.mjs` — asserts every route in `http.ts` has a matching `routes.ts` entry (structural coverage of the endpoints those scenarios hit).
- `test/openapi.test.mjs` — asserts the emitted OpenAPI doc has paths + components + operationIds (so external clients cited in `external-review-feedback.feature` can consume the spec).

If the repo adopts a Cucumber runner in a later unit, the `.feature` files will hang step definitions off the same Zod schemas exported from this package. No duplicate contract maintenance.

### Risk assessment

1. **`zod-to-json-schema` incompatibility with discriminated unions.** Zod discriminated unions (used for `WsClientMessageSchema`, `SessionPayloadSchema`) don't always round-trip cleanly to OpenAPI 3.1 `oneOf`. **Mitigation:** Test the emitter on the discriminated unions first; fall back to `oneOf` with `discriminator.propertyName` hand-authored if the converter produces a non-standard shape.
2. **Schema divergence from http.ts.** The existing inline `DecideSchema`, `QuestionAnswerSchema`, `DirectionSelectSchema`, `FeedbackCreateSchema`, `FeedbackUpdateSchema` in `http.ts` are the ground truth for requests. The new schemas MUST match them exactly — any field drift breaks when unit-02 swaps `http.ts` to import from `haiku-api`. **Mitigation:** Copy the inline schemas verbatim into `haiku-api/src/schemas/`, then the unit-02 PR simply imports them.
3. **Response shapes are hand-authored strings in http.ts.** The response bodies (e.g., `Response.json({ ok: true, decision, feedback })`) are not currently schematized. **Mitigation:** Read each `Response.json({...})` literal in `http.ts` and translate to a Zod schema. Unit-02 can then swap to `ReviewDecisionResponseSchema.parse(...)` for defense-in-depth.
4. **OpenAPI `openapi: 3.1.0` vs Zod's JSON-Schema output.** `zod-to-json-schema` emits JSON Schema draft-07 by default; OpenAPI 3.1 aligns with draft 2020-12. **Mitigation:** Pass `target: "openApi3"` option to `zod-to-json-schema` and assert `openapi === "3.1.0"` in the test.
5. **Root has no tsconfig.** The completion criterion "`npx tsc --noEmit` passes at the repo root" is ambiguous — there is no root `tsconfig.json`. **Mitigation:** Run `npx tsc --noEmit` inside each workspace (`packages/haiku-api`, `packages/haiku`, `packages/shared`, `website`) and assert each exits 0. Interpret the completion criterion as "repo-wide typecheck passes", matching how `biome.json` globs `packages/**`.
6. **`type: "module"` vs tsx ESM execution.** `package.json` declares `"type": "module"`; `tsconfig.json` emits NodeNext; tsx handles ESM natively. **Mitigation:** Pin script imports to `.js` extensions in source (TypeScript ESM convention); emit-openapi script uses `.mjs` extension.
7. **Test runner choice.** Root already uses `node --test` in one place and `tsx test/*.test.mjs` in another (per `packages/haiku/package.json`). **Mitigation:** Mirror `packages/haiku/test/run-all.mjs` pattern (`test: "node test/run-all.mjs"` with a `run-all.mjs` that imports each `.test.mjs`). This keeps the test surface homogeneous with sibling packages.
8. **Workspace name collision.** Root `package.json` workspaces already include `packages/haiku` (scoped `@haiku/haiku`) and `packages/shared` (scoped `@haiku/shared`). The new package is `haiku-api` (unscoped per spec). **Mitigation:** The name in `package.json` is exactly `haiku-api`; `npm` accepts unscoped names in workspaces. Double-check with `npm ls -ws` after install.

### Anti-patterns to avoid (per hat guidance)

- Do NOT refactor `packages/haiku/src/http.ts` to consume `haiku-api` in this unit — that's unit-02 scope.
- Do NOT modify `packages/haiku/review-app/src/types.ts` or any review-app code — that's unit-03+ scope.
- Do NOT plan more files than can be completed in one bolt — the 18-file surface above is one coherent package extraction, not spread across multiple bolts.
- Do NOT skip the "parses valid + rejects invalid" pairing for any schema — the completion criterion requires it.
- Do NOT leave OpenAPI emission as a test-only helper — it must run at build time (`npm run build -w haiku-api`).

