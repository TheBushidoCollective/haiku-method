---
title: >-
  getIntentScopeTickCounter: non-atomic read-write + V-04 anti-pattern + silent
  failure breaks V-05 contract
status: addressed
origin: adversarial-review
author: architecture (from development)
author_type: agent
created_at: '2026-05-03T11:06:55Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 3
triaged_at: '2026-05-03T11:06:55Z'
resolution: inline_fix
replies: []
hat: security-engineer
iterations:
  - bolt: 3
    hat: security-engineer
    completed_at: '2026-05-03T14:13:51Z'
    result: advanced
---
## Finding

`packages/haiku/src/state-tools.ts:2278-2302` implements the V-05 intent-scope tick counter:

```ts
export function getIntentScopeTickCounter(intentDirAbsPath: string): number {
    const tickFile = intentScopeTickPath(intentDirAbsPath)
    let current = 0
    try {
        if (existsSync(tickFile)) {
            const raw = readFileSync(tickFile, "utf-8")
            const parsed = JSON.parse(raw) as { tick?: unknown }
            if (typeof parsed.tick === "number" && parsed.tick >= 0) {
                current = parsed.tick
            }
        }
    } catch {
        current = 0
    }
    const next = current + 1
    try {
        mkdirSync(dirname(tickFile), { recursive: true })
        writeFileSync(tickFile, JSON.stringify({ tick: next }, null, 2))
    } catch {
        // Best-effort persistence — return the increment even if the
        // write failed so the caller still gets a deterministic value
        // for THIS process's lifetime.
    }
    return next
}
```

Three architectural concerns:

1. **Read-increment-write is not atomic.** Even within one Node process, the `readFileSync` → compute `next` → `writeFileSync` is interruptible at the I/O boundaries. The comment at lines 2294-2300 acknowledges this with "Best-effort persistence" but the V-05 mitigation contract claims **deterministic** counter semantics. ASSESSMENTS.md §2 V-05 row claims `getIntentScopeTickCounter` "returns deterministic intent-scope counter persisted to `intent-tick.json`" — the implementation provides "deterministic for this process if persistence succeeds, otherwise the in-memory value the previous read happened to see."

2. **`mkdirSync(dirname(tickFile), { recursive: true })`** at line 2294 is exactly the V-04 anti-pattern that unit-03 invested an entire module (`safeMkdirAndRename`) to eliminate. `intent-tick.json` lives at `.haiku/intents/{slug}/intent-tick.json`; `dirname` is the intent dir which always exists, so the practical risk is low — but the pattern itself is the one the security stage just spent effort removing. A future code path that calls this with a non-existent intent dir would re-introduce the symlink-follow vector at the SAME chokepoint that V-05 closes.

3. **Failure mode swallows persistence errors.** When `writeFileSync` throws (disk full, permission, racing process), the function returns the incremented value but the on-disk counter never advances. The next call reads the stale value and returns the same "next" value — collision in the entry-id space the V-05 fix is supposed to prevent.

## Why this matters

The V-05 mitigation is the load-bearing contract for SPA upload action-log entry IDs. The drift gate's union-of-action-logs read (the consumer-side fix in `drift-detection-gate.ts`) assumes the producer-side IDs are unique. A silent-failure persistence mode in the producer breaks the consumer's invariant. This is not a "spirit vs letter" violation — the letter (deterministic counter) and the spirit (collision-free entry IDs) are the same contract, and the implementation fulfills neither under failure modes.

## Suggested remediation

- Use a tempfile-rename pattern for atomicity: write to `intent-tick.json.tmp.{random}`, fsync, rename. Match the durability semantics already used for `baseline.json` writes in `drift-baseline.ts`.
- Replace the `mkdirSync(..., { recursive: true })` with the V-04 `safeMkdirAndRename` pattern (or assert the parent exists, since `intent-tick.json` is intent-scoped and the intent dir is the workflow engine's substrate — non-existence here is already a corruption signal).
- On persistence failure, throw rather than return a stale-derived value. Callers can decide whether to fail the upload or fall back to a UUID-shaped entry ID.

## Source references

- `packages/haiku/src/state-tools.ts:2278-2302` — implementation
- `packages/haiku/src/state-tools.ts:2253-2258` — comment narrative claims "best-effort single-process counter"
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md:61` — V-05 row claims deterministic semantics
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` — consumer that depends on the contract holding
