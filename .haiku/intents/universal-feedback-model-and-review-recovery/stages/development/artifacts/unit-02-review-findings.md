# unit-02 review findings — bolt 3

Reviewer: development/reviewer (bolt 3)
Decision: **REQUEST CHANGES**

## Summary

Substantial, high-quality implementation. `packages/haiku/src/http.ts` consumes `haiku-api` schemas across every JSON handler, uniform 400 `validation_failed` envelope is in place, 413 caps (default 1 MiB + 128 KiB feedback override), WebSocket frame cap (1009) + rate limit (1008), transport-invariant loopback assertion, cross-session 403 guard, and the new `POST /api/revisit/:sessionId` endpoint are all implemented. Tests are comprehensive across the security surface — tsc passes, 505/505 tests pass in `packages/haiku`, 108/108 in `packages/haiku-api`, and `test-deltas.json` shows 0 regressions vs baseline.

However, two completion criteria are not fully satisfied:

## Finding 1 (confidence: HIGH) — Missing path-traversal tests on stream handlers

**Criterion (quoted):**
> "Stream handlers call `files.ts` path-refinement before filesystem access; path-traversal fixture set returns 403 (not 200, not 400)."
> "Path traversal on file-serve routes → 403."

**Evidence:**
- Grep across `packages/haiku/test/` for `mockups`, `wireframe`, `stage-artifacts`, `/files/`, `handleMockupGet`, `forbidden_path_traversal`, `handleFileGet` returns zero test references.
- The runtime guards (`resolvePathSafe` + `serveUnderRoot` returning `{error:"forbidden_path_traversal"}` at 403) are in place in `packages/haiku/src/http.ts` (lines 169–194, 475–487), but nothing asserts they fire correctly for the five named stream handlers.

**Required fix:**
Add tests (suggested location: a new `packages/haiku/test/http-streams.test.mjs`, or extend `http-feedback.test.mjs`) that spin up the real http server and for each of `handleFileGet`, `handleMockupGet`, `handleWireframeGet`, `handleStageArtifactGet` verify a path-traversal fixture returns 403:

Suggested fixtures (at minimum one per handler):
- `GET /files/{sessionId}/..%2F..%2Fetc%2Fpasswd` → 403 (or 404 with explicit contract — current code returns 404 for /files; spec says 403; reconcile)
- `GET /mockups/{sessionId}/..%2F..%2Fetc%2Fpasswd` → 403 with `{error:"forbidden_path_traversal"}`
- `GET /wireframe/{sessionId}/..%2F..%2Fetc%2Fpasswd` → 403
- `GET /stage-artifacts/{sessionId}/..%2F..%2Fetc%2Fpasswd` → 403

Note: `handleFileGet` currently returns 404 on traversal escape (see http.ts line 466 — "we keep 404 to avoid breaking that contract"). The spec explicitly says "path-traversal fixture set returns 403 (not 200, not 400)" — either change `handleFileGet` to return 403 on traversal or justify the 404 contract in a review-note.

## Finding 2 (confidence: MEDIUM) — Local type literal `DecodeResult` in http.ts

**Criterion (quoted):**
> "grep for TypeScript type definitions in http.ts returns zero (types come from the schema package)."

**Evidence:**
- `grep -n "^interface\|^type\s" packages/haiku/src/http.ts` returns exactly one hit: line 765 `type DecodeResult = ...`.

**Analysis:**
`DecodeResult` is an internal return-type union for `decodeWebSocketFrame` — it signals (need-more-bytes | too-large | success). It is not a wire contract and not a JSON handler request/response type. The spirit of the criterion is "wire types flow from haiku-api"; `DecodeResult` is a byte-decoder control flow type with no wire representation.

**Required fix (one of):**
- Inline the union return type on the function signature (`function decodeWebSocketFrame(buf: Buffer): { payload: string|null; opcode: number; consumed: number } | { tooLarge: true; consumed: number } | null`) so the grep returns zero.
- Move the decoder (and its helper type) into a separate `src/ws-frame.ts` module and re-export just the function from http.ts.
- Add a narrow exception note in the builder artifact and adjust the criterion — but this requires intent-level review; prefer a mechanical fix.

## Finding 3 (confidence: LOW — informational, not a blocker on its own)

`FileServeParamsSchema` and `QuestionImageParamsSchema` exist in `packages/haiku-api/src/schemas/files.ts` but are never imported by `http.ts`. The spec says "Stream handlers ... validate path params against the `files.ts` schemas' path refinements." The current schemas only enforce `min(1)` — they don't actually contain path-traversal refinements, so importing them would add no runtime safety.

If the schema owner intended path-refinement logic to live in `files.ts`, the schema should be extended with a `.refine()` that rejects `..` and absolute paths, and the stream handlers should then consume that schema. If the schema is intentionally loose and runtime guards are the layer of truth, the spec should be amended. Either way, the current state leaves `files.ts` schemas unused at the edge.

Flagged as **LOW** because behavior is correct — the stronger runtime guards (`resolvePathSafe`) do the work. But the declared architecture says the schema refinements should be the guard, and they currently aren't.

## What's solid (won't change on rework)

- `haiku-api` schemas are imported at every JSON handler (verified against the 10 handler list in the spec).
- `parseJsonBody` produces the correct `{error:'validation_failed', issues:ZodIssue[]}` envelope with 413 on cap exceed.
- Per-route body caps: 128 KiB for feedback POST/PUT, default 1 MiB elsewhere; bridge-level + handler-level enforcement both tested.
- WS frame cap (1009) + rate limit (1008) wired end-to-end with a real-socket integration test.
- Transport invariant: loopback assert + child-process test forcing non-loopback bind → non-zero exit.
- Cross-session mutation guard: soft for POST, hard 403 for PUT/DELETE on session mismatch; covered by three integration tests.
- Revisit endpoint wires through to the orchestrator's `haiku_revisit` handler; malformed body → 400 validated.
- Test baseline captured on the parent commit (`bbf55667` — builder's first commit) and diffed against HEAD: 0 regressions, 47 new tests.
- `npx tsc --noEmit` clean for both packages.

## Recommended builder actions (in order)

1. Add path-traversal 403 assertions for `/mockups`, `/wireframe`, `/stage-artifacts`, `/files` (Finding 1). Decide + document the `/files` 404-vs-403 divergence.
2. Inline or relocate `DecodeResult` so http.ts has zero local type declarations (Finding 2).
3. Optional: either tighten `FileServeParamsSchema` with a path-traversal refinement and wire it in, or amend the unit spec for Finding 3.

Re-run `npm test`, `npx tsc --noEmit`, and regenerate `artifacts/test-deltas.json` before requesting re-review.
