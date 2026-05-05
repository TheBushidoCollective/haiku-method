---
title: >-
  Reliability: haiku_human_write MCP tool has no content size cap, leaving an
  unbounded disk-fill / OOM vector
status: closed
origin: adversarial-review
author: reliability (from operations)
author_type: agent
created_at: '2026-05-03T11:05:34Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-30:bolt-3'
bolt: 3
triaged_at: '2026-05-03T11:05:34Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:13:52Z'
    result: advanced
  - bolt: 3
    hat: feedback-assessor
    completed_at: '2026-05-03T14:15:49Z'
    result: closed
---
## Finding

The security stage's V-07 mitigation hard-capped uploads on the SPA path: `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB` with `Math.min(envValue, hardCap)` clamping in `packages/haiku/src/http/upload-routes.ts:84-89`. The justification (V-07 row in ASSESSMENTS.md) is operational reliability: "a misconfigured 10 GB env value combined with the synchronous SHA-256 in the drift gate stalls the workflow tick (the gate hashes every uploaded file on every tick to detect drift; a 10 GB hash blocks the tick for minutes)."

That same threat applies symmetrically to the MCP-tool write path (`packages/haiku/src/tools/orchestrator/haiku_human_write.ts`), and the cap is **missing** there.

`haiku_human_write` accepts a `content` string (UTF-8 or base64) with **no size validation**:

- `haiku_human_write.ts:355-396` — schema declares `content` as a plain `string` with no `maxLength`.
- `haiku_human_write.ts:402-545` — handler decodes content via `Buffer.from(content, encoding)` and writes via `writeFile` with no size check.
- The decoded `contentBytes` flows directly into `appendActionLogEntry` + `appendWriteAudit` and the destination file write — same drift-gate hashing path the SPA cap exists to protect.

A misbehaving / compromised agent (the same threat surface V-03 / V-04 / V-08 protect against) can submit a 500 MiB or 5 GiB content payload via `haiku_human_write` and:

1. Buffer the entire decoded payload in process memory (potential OOM on a memory-constrained MCP host).
2. Write the file to disk (potential disk-fill on a small `.haiku/` filesystem).
3. Stall the next workflow tick by forcing the drift gate to hash a multi-gigabyte file synchronously (the exact harm V-07 was filed to prevent on the SPA path).
4. Bloat `write-audit.jsonl` with an action-log entry that records a multi-gigabyte-sized write.

## Mandate spirit

The reliability mandate says "verify that resource limits (CPU, memory, connections) are set appropriately." Memory + disk are resource limits. The security stage capped one entry point (SPA) and left the other (MCP tool) uncapped, even though they share the same downstream impact (drift-gate sync hash). An attacker who notices the asymmetry simply uses the uncapped surface.

## Why this is in scope for the security stage

The security stage owns V-07 and is the natural owner of the cap symmetry: V-07 was filed because uncapped write size stalls the workflow tick; that stall happens regardless of which write entry point fed the bytes. The security stage's V-04 / V-08 work also explicitly treats the MCP path and SPA path as parallel surfaces requiring identical mitigations (`safeMkdirAndRename` is the canonical example — same fix applied at both call sites). The V-07 mitigation breaks that pattern by skipping the MCP surface.

THREAT-MODEL.md §3.5 D-1 covers the SPA case but does NOT have a corresponding row for the MCP-tool D-1 equivalent.

## Recommended fix

1. Add a constant in `packages/haiku/src/tools/orchestrator/haiku_human_write.ts`:
   ```ts
   const MAX_CONTENT_BYTES_HARD_CAP = 50 * 1024 * 1024 // 50 MiB
   ```
   Match the SPA cap so the two surfaces have symmetric resource bounds.
2. Validate decoded `contentBytes.length` BEFORE the disk write:
   ```ts
   if (contentBytes.length > MAX_CONTENT_BYTES_HARD_CAP) {
     return errorResult("content_too_large", ...)
   }
   ```
3. Optional: refuse the request earlier on `content.length` (string length) before allocating the decoded `Buffer` — for base64 the decoded size is roughly `content.length * 0.75`, so a `content.length > MAX_CONTENT_BYTES_HARD_CAP * 1.34` guard avoids the worst-case buffer allocation.
4. Add a regression test in `packages/haiku/test/haiku-human-write.test.mjs`:
   ```ts
   test("V-07 (MCP): rejects content larger than MAX_CONTENT_BYTES_HARD_CAP", ...)
   ```
5. Update THREAT-MODEL.md §3.5 to add a D-1' row for the MCP path mirroring D-1.
6. Update ASSESSMENTS.md V-07 row to note the MCP cap parallels the SPA cap.

## Severity

**Medium** — reliability + DoS. The harm is identical to V-07's documented harm ("stalls the workflow tick") but the mitigation is one-sided. A compromised agent (the V-03 / V-04 / V-08 threat actor) is the realistic exploiter; they have a working path through `haiku_human_write` already. The drift-gate sync-hash stall is the clear operational impact.

## Files affected

- `packages/haiku/src/tools/orchestrator/haiku_human_write.ts:355-545` (schema + handler — no cap)
- `packages/haiku/src/http/upload-routes.ts:84-89` (the SPA-side cap, for reference / symmetry)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md:233` (D-1 row missing MCP analogue)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md` V-07 row (caps documented as SPA-only)
- `packages/haiku/test/haiku-human-write.test.mjs` (regression test missing)
