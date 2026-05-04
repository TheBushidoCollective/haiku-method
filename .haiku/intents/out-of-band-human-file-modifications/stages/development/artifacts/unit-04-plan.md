# Implementation Plan — unit-04-pre-tick-drift-gate

**Hat:** planner  
**Unit:** unit-04-pre-tick-drift-gate  
**Stage:** development

---

## 1. Scope Summary

This unit delivers the pre-tick drift-detection gate and its integration into `run-tick.ts`. Units 01–03 have already landed:

- **unit-01**: `drift-baseline.ts` — `readBaseline`, `writeBaseline`, `computeFileSha256`, `isBinary`, `enumerateTrackedSurface`, `canonicalisePath`, `updateBaselineEntry`, `BaselineCorruptError`.
- **unit-02**: `drift-markers.ts` — `readMarkers`, `writeMarkers`, `appendMarker`, `findOpenMarker`, `clearMarker`, `isStaleMarker`, `removeMarker`.
- **unit-03**: `action-log.ts` / `write-audit.ts` — `ActionLogEntry`, `appendActionLogEntry`, `readActionLogForTick`, `findActionLogEntryForPath`.

All three modules are confirmed present on disk. This unit must NOT re-implement any of those primitives.

This unit's deliverables:
1. `drift-detection-gate.ts` — the pure gate function.
2. `handlers/manual-change-assessment.ts` — the handler that builds the `manual_change_assessment` action payload.
3. `orchestrator/prompts/manual_change_assessment.ts` — prompt builder for the action.
4. Modifications to `run-tick.ts` — wire the gate into the pre-tick chain.
5. Modifications to `types.ts` — add `manual_change_assessment` to `StateName`.
6. Modifications to `handlers/index.ts` — register the new handler.
7. Modifications to `orchestrator/prompts/index.ts` — register the prompt builder.
8. Test file: `test/drift-detection-gate.test.mjs`.

---

## 2. Existing Module Inventory

### Confirmed present (do not recreate)

| File | Key exports used by this unit |
|---|---|
| `orchestrator/workflow/drift-baseline.ts` | `readBaseline`, `writeBaseline`, `computeFileSha256`, `isBinary`, `enumerateTrackedSurface`, `BaselineCorruptError`, `BaselineEntry`, `Baseline`, `TrackedSurfaceEntry` |
| `orchestrator/workflow/drift-markers.ts` | `readMarkers`, `findOpenMarker`, `isStaleMarker`, `removeMarker` |
| `orchestrator/workflow/action-log.ts` | `readActionLogForTick`, `findActionLogEntryForPath` |
| `orchestrator/workflow/write-audit.ts` | `ActionLogEntry` (type) |
| `orchestrator/workflow/run-tick.ts` | `runWorkflowTick` — modify only the pre-tick chain |
| `orchestrator/workflow/types.ts` | `StateName` — add `manual_change_assessment` |
| `orchestrator/workflow/handlers/index.ts` | `REGISTRY` — add `manual_change_assessment` |
| `orchestrator/prompts/index.ts` | `actionPromptBuilders` — add entry |
| `tools/orchestrator/haiku_baseline_init.ts` | `isDriftDetectionDisabled` helper pattern (copy/adapt) |

### Files this unit creates

| File | Purpose |
|---|---|
| `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` | Main gate: `runDriftDetectionGate()` |
| `packages/haiku/src/orchestrator/workflow/handlers/manual-change-assessment.ts` | Handler: builds the `manual_change_assessment` action |
| `packages/haiku/src/orchestrator/prompts/manual_change_assessment.ts` | Prompt builder for the action |
| `packages/haiku/test/drift-detection-gate.test.mjs` | Tests covering every feature scenario |

---

## 3. Key Design Decisions (Inputs)

### 3.1 Kill-switch (AC-G1-KS)

`settings.yml` field `drift_detection: false` → gate is a complete no-op.

Reading pattern (from `haiku_baseline_init.ts`):
```ts
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"

function isDriftDetectionDisabled(root: string): boolean {
  const settingsPath = join(root, "settings.yml")
  if (!existsSync(settingsPath)) return false
  try {
    const raw = readFileSync(settingsPath, "utf8")
    const { data } = matter(`---\n${raw}\n---\n`)
    return (data as Record<string, unknown>).drift_detection === false
  } catch { return false }
}
```

The `root` is the `.haiku` directory. The gate needs to receive the haiku root path via `ctx`. `run-tick.ts` already has `findHaikuRoot()` in scope through `state-tools.js`. We pass it through a context parameter.

### 3.2 DriftFinding shape (DATA-CONTRACTS.md §3.1)

```ts
interface DriftFinding {
  path: string                // canonical, intent-relative
  change_kind: "new-file-detected" | "modified" | "file-removed"
  is_binary: boolean
  diff_unified: string | null  // null for binary, null for large files
  before_sha256: string | null // null for new-file-detected
  after_sha256: string | null  // null for file-removed
  before_bytes: number | null
  after_bytes: number | null
  tracking_class: TrackingClass
  stage: string | null
  context_unit: string | null
}
```

Cross-field invariants (enforced before emission):
- `new-file-detected` ⇒ `before_sha256 === null && before_bytes === null`
- `file-removed` ⇒ `after_sha256 === null && after_bytes === null && diff_unified === null`
- `modified` ⇒ all four non-null AND `before_sha256 !== after_sha256`
- `is_binary === true` ⇒ `diff_unified === null`

### 3.3 Gate return type

```ts
interface DriftDetectionGateResult {
  findings: DriftFinding[]
  baselineEstablished: boolean
  action: "manual_change_assessment" | null
  error?: "baseline_corrupt"
}
```

Gate context parameter:
```ts
interface DriftGateCtx {
  intentDir: string       // absolute path to intent directory
  intentSlug: string
  activeStage: string
  haikuRoot: string       // for kill-switch settings read
  tickCounter: number
  settings?: { drift_detection?: boolean }  // pre-read by caller (optional opt)
}
```

### 3.4 Out-of-sync heuristic (ARCHITECTURE.md §8.3)

When `findings.length > 0.5 * trackedSurfaceSize` → replace findings list with single synthetic finding:
```ts
{ change_kind: "modified", path: "<stage>", is_binary: false, diff_unified: null,
  before_sha256: null, after_sha256: null, before_bytes: null, after_bytes: null,
  tracking_class: "stage-output", stage: activeStage, context_unit: null,
  is_baseline_oom: true }
```
The `manual_change_assessment` handler's default for `is_baseline_oom` findings is `trigger-revisit`.

### 3.5 Diff generation

For **text modified** files: unified diff with 3 lines of context, truncated to 200 lines with trailing note.
- Baseline content: read from the _prior baseline entry SHA_. But we don't store content — we need to re-read the file from disk at baseline's path. Since baselines don't cache content, we need to read current content, and for the prior we must either: (a) use `git show <blob-sha>`, or (b) note we cannot diff and emit `diff_unified: null`.
- **Decision**: Attempt `git show <sha>` in the worktree. If not available (not a git repo, or SHA not found in git), emit `diff_unified: null`. This avoids storing content in baselines and keeps the gate clean.
- For **new-file-detected** text files under 256 KB: full content as a `+++`-only diff.
- For **file-removed**: `diff_unified: null` (no current file to diff from).

### 3.6 Author-class attribution (from action-log)

Per finding: call `findActionLogEntryForPath(actionLogEntries, pathRel)`. If a `human_write` entry exists for the path in the current tick, set `author_class: "human-via-mcp"`. Otherwise use baseline's `author_class` and let the assessment handler downgrade to `human-implicit`.

### 3.7 Baseline establishment (AC-G8)

When `readBaseline()` returns `null`:
- Enumerate tracked surface.
- Hash every file with `computeFileSha256`.
- Write baseline with `author_class: "agent"`, `acknowledged_via: "baseline-init"`.
- Return `{ findings: [], baselineEstablished: true, action: null }`.

Also: update `state.json` to stamp `drift_baseline_established_at` (per feature file scenario).

---

## 4. Files to Modify

### 4.1 `orchestrator/workflow/types.ts`

Add `"manual_change_assessment"` to `StateName`.

### 4.2 `orchestrator/workflow/run-tick.ts`

After the `preTickFeedbackGate` block, add:

```ts
// Pre-tick drift-detection gate. Runs after feedback-triage (which may
// relocate files) and before per-state dispatch.
// Chain: tamper-detection → feedback-triage → drift-detection → dispatch.
const driftResult = await runDriftDetectionGate({
  intentDir: derived.context.intentDirPath,
  intentSlug: slug,
  activeStage: derived.context.currentStage,
  haikuRoot: root ?? findHaikuRoot(),
  tickCounter: /* derived from stageState or 0 */ ...
})
if (driftResult.error === "baseline_corrupt") {
  return { state: "error", context: derived.context,
           action: { action: "error", message: driftResult.errorMessage } }
}
if (driftResult.findings.length > 0) {
  // Build manual_change_assessment action via handler.
  const driftAction = buildManualChangeAssessmentAction(slug, derived.context, driftResult)
  return { state: "manual_change_assessment", context: derived.context, action: driftAction }
}
```

Note: `runWorkflowTick` is currently synchronous. Since `computeFileSha256` and `isBinary` return Promises, the gate is async. We need to either:
- Make `runWorkflowTick` async, OR
- Run the gate synchronously using `execSync`/sync file reads.

**Decision**: Make `runDriftDetectionGate` accept an optional `sync` mode, or better: look at how `run-tick.ts` handles async. Currently `runWorkflowTick` is sync. The gate uses async file I/O. Options:
1. Keep the gate sync by using sync SHA computation.
2. Make `runWorkflowTick` return a Promise.

The feedback-triage gate is synchronous. The existing architecture expects synchronous handlers. The safest approach: **make `runDriftDetectionGate` sync** by using Node's sync crypto + sync file reads. SHA computation can be sync (`readFileSync` + `createHash`). `isBinary` can be sync. `enumerateTrackedSurface` is already sync.

This means adding a `computeFileSha256Sync(path)` helper in drift-baseline.ts, or implementing the sync SHA inline in the gate.

**Plan**: Add `computeFileSha256Sync` to `drift-baseline.ts`, and a sync `isBinarySync` variant. The gate stays sync. `runWorkflowTick` stays sync.

### 4.3 `orchestrator/workflow/handlers/index.ts`

Register `manual_change_assessment: manualChangeAssessment` in `REGISTRY`.

### 4.4 `orchestrator/prompts/index.ts`

Register `["manual_change_assessment", manual_change_assessment]` in `actionPromptBuilders`.

---

## 5. New Files in Detail

### 5.1 `drift-detection-gate.ts`

```
Signature:
  runDriftDetectionGate(ctx: DriftGateCtx): DriftDetectionGateResult

Steps:
  1. Kill-switch check: if drift_detection === false, return no-op result.
  2. Read action log for current tick (readActionLogForTick) — async, but since
     gate is sync, read the file synchronously.
  3. Read markers: readMarkers(intentDir).
  4. Read baseline: readBaseline(intentDir, activeStage).
     - If throws BaselineCorruptError → return { error: 'baseline_corrupt' }.
     - If null → establish mode:
         a. Enumerate tracked surface.
         b. Hash every file (sync).
         c. Build new Baseline.
         d. writeBaseline (async — needs Promise.resolve pattern or sync write).
         e. Stamp drift_baseline_established_at in state.json.
         f. Return { findings: [], baselineEstablished: true, action: null }.
  5. Enumerate tracked surface: enumerateTrackedSurface(intentDir, activeStage).
  6. For each entry in tracked surface:
       a. Compute SHA (sync).
       b. Look up baseline entry by pathRel.
       c. If not in baseline: new-file-detected event candidate.
       d. If in baseline and SHA matches: no event.
       e. If in baseline and SHA differs:
            - findOpenMarker(markerStore, pathRel).
            - If open marker and NOT stale (currentSha === marker.baseline_sha_at_creation): suppress.
            - If open marker AND stale (isStaleMarker): removeMarker, emit event.
            - If no open marker: emit event.
  7. For each baseline entry NOT in tracked surface (file removed):
       - file-removed event.
  8. Compute out-of-sync heuristic: if findings.length > 0.5 * trackedSurfaceSize.
  9. Return { findings, baselineEstablished: false, action: findings.length > 0 ? 'manual_change_assessment' : null }.
```

**On `writeBaseline` async**: baseline establish-mode needs to write the file. Since `runWorkflowTick` is sync, we need to either:
- Call `writeBaseline` with a fire-and-forget approach using `writeFileSync` directly, OR
- Add a `writeBaselineSync` variant.

**Plan**: Add `writeBaselineSync` to `drift-baseline.ts` for use by the gate (no atomic rename guarantee needed since this is a fresh create, not a concurrent-reader scenario — the gate is the only writer at establish time).

Wait — `writeBaseline` already uses atomic rename for safety. For the establish case during a tick, a sync write is fine. We'll add a thin sync helper.

### 5.2 `handlers/manual-change-assessment.ts`

Builds the `manual_change_assessment` action payload per DATA-CONTRACTS.md §3.2:

```ts
export default function manualChangeAssessmentHandler(
  context: DerivedContext,
  findings: DriftFinding[],
): OrchestratorAction
```

Payload shape:
```json
{
  "action": "manual_change_assessment",
  "intent_slug": "<slug>",
  "stage": "<active-stage>",
  "tick_id": "tick-<timestamp>-<short-hash>",
  "findings": [...],
  "mode": "<mode from intent>",
  "instructions": "<generated text>",
  "legal_outcomes": { "<path>": ["ignore","inline-fix","surface-as-feedback","trigger-revisit"] }
}
```

Legal outcomes derived from DATA-CONTRACTS.md §3.4 legality matrix:
- `file-removed` → exclude `inline-fix`
- All other change kinds → all four outcomes
- Current-stage finding → exclude `trigger-revisit` (AC-CO1)

### 5.3 `orchestrator/prompts/manual_change_assessment.ts`

Follows `feedback_triage.ts` pattern. Renders:
- List of findings with their change_kind, path, stage_owner, is_binary, diff_unified excerpt
- Classification instructions: call `haiku_classify_drift` with outcomes per legal_outcomes map
- After classifying all findings, call `haiku_run_next`

---

## 6. drift-baseline.ts Additions

Add these two exports at the end of `drift-baseline.ts`:

```ts
/** Synchronous SHA-256 computation for use in sync contexts (gate). */
export function computeFileSha256Sync(absolutePath: string): string {
  const buf = readFileSync(absolutePath)
  return createHash("sha256").update(buf).digest("hex")
}

/** Synchronous variant of writeBaseline — used for establish-mode first write. */
export function writeBaselineSync(intentDir: string, stage: string, baseline: Baseline): void {
  const targetPath = baselinePath(intentDir, stage)
  const targetDir = dirname(targetPath)
  mkdirSync(targetDir, { recursive: true })
  const sortedKeys = Array.from(baseline.entries.keys()).sort()
  const diskObj: Record<string, BaselineEntry> = {}
  for (const key of sortedKeys) {
    const entry = baseline.entries.get(key)
    if (entry !== undefined) diskObj[key] = entry
  }
  writeFileSync(targetPath, `${JSON.stringify(diskObj, null, 2)}\n`, "utf-8")
}

/** Synchronous binary detection for use in sync contexts (gate). */
export function isBinarySync(absolutePath: string): boolean {
  try {
    const stat = statSync(absolutePath)
    const bytesToRead = Math.min(stat.size, 8192)
    if (bytesToRead === 0) return false
    const buf = Buffer.alloc(bytesToRead)
    const fd = openSync(absolutePath, "r")
    try {
      readSync(fd, buf, 0, bytesToRead, 0)
    } finally {
      closeSync(fd)
    }
    const slice = buf.subarray(0, bytesToRead)
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) return true
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(slice)
    } catch { return true }
    return false
  } catch { return false }
}
```

Also add a sync action-log read helper (or the gate reads the file synchronously inline).

---

## 7. run-tick.ts Changes

Since `runWorkflowTick` is sync and the gate is sync:

```ts
import { runDriftDetectionGate } from "./drift-detection-gate.js"
import { findHaikuRoot } from "../../state-tools.js"

// In runWorkflowTick, after the triageAction block:
const driftResult = runDriftDetectionGate({
  intentDir: derived.context.intentDirPath,
  intentSlug: slug,
  activeStage: derived.context.currentStage,
  haikuRoot: root ?? findHaikuRoot(),
  tickCounter: (derived.context.stageState.tick_counter as number) ?? 0,
})
if (driftResult.error === "baseline_corrupt") {
  return {
    state: "error",
    context: derived.context,
    action: {
      action: "error",
      message: `Baseline file for stage '${derived.context.currentStage}' is corrupt. Run haiku_repair to re-establish the baseline.`,
    },
  }
}
if (driftResult.findings.length > 0) {
  return {
    state: "manual_change_assessment",
    context: derived.context,
    action: buildManualChangeAssessmentAction(slug, derived.context, driftResult),
  }
}
```

---

## 8. Test Coverage Plan (test/drift-detection-gate.test.mjs)

One test case per scenario in `features/silent-filesystem-drop-detection.feature`:

1. **Designer replaces layout** — write file, change SHA, call gate → finds `modified` finding with diff.
2. **PO edits deliverable** — same pattern, different file.
3. **User drops new knowledge file (binary PDF)** — new file → `new-file-detected`, `is_binary: true`, `diff_unified: null`.
4. **Alias outputs/ → artifacts/** — write to `outputs/`, gate produces canonical `artifacts/` key.
5. **Multiple files in one tick** — 3 files changed → single action with 3 findings.
6. **Zero changes** — no findings, no action emitted.
7. **Mid-bolt isolation** — file changed after gate already ran (gate only sees tick-time state).
8. **First tick establish (no baseline.json)** — `baselineEstablished: true`, zero findings, baseline written.
9. **Kill-switch disabled** — `drift_detection: false` → zero findings, zero reads, zero writes.
10. **Kill-switch re-enable** — existing baseline reused, no auto-establish, repair needed.
11. **Editor temp files** — `.spec.md.swp` not emitted; `spec.md` (if changed) emitted.
12. **Deletion** — file removed → `file-removed` finding, `after_sha256: null`, `diff_unified: null`.
13. **Binary replacement** — `is_binary: true`, `diff_unified: null`, SHAs present.
14. **Marker suppression (matching SHA)** — open marker with current SHA matching `baseline_sha_at_creation` → suppressed.
15. **Marker stale (double-edit)** — SHA differs from `baseline_sha_at_creation` → marker removed, new finding emitted.
16. **Marker terminal-state cleared** — (integration: baseline clears on FB closed) — tested via clearMarker pattern.
17. **Baseline corrupt halt** — invalid JSON in baseline.json → `error: baseline_corrupt`.
18. **Files outside tracked surface** — README.md not detected.
19. **Files inside `units/` ignored** — AC-UO2 negative case.

---

## 9. Risks & Mitigations

### Risk 1: sync SHA computation performance
Large files (>1 MB) read synchronously block the event loop during the tick. Acceptable for v1 per ARCHITECTURE.md §3.3 (no daemon model, tick is reconciliation unit). Mitigation: only read files in the tracked surface.

### Risk 2: Diff generation needs baseline content
We don't cache prior file content. Plan: attempt `git show <sha>` (exec sync). If unavailable, emit `diff_unified: null`. The test mock can return null for diff and assert the finding still emits correctly.

### Risk 3: `run-tick.ts` currently sync, gate needs sync variants
Addressed in §6 above — add sync variants to `drift-baseline.ts`.

### Risk 4: `findHaikuRoot()` may throw in test contexts
The gate receives `haikuRoot` as a parameter from `run-tick.ts`; tests pass it directly. No issue.

### Risk 5: `state.json` write for `drift_baseline_established_at`
Requires updating stage state. Use `writeJson` (already exported from `state-tools.ts`). The path is `join(intentDir, "stages", activeStage, "state.json")`.

---

## 10. Completion Order

1. Add sync helpers to `drift-baseline.ts` (`computeFileSha256Sync`, `isBinarySync`, `writeBaselineSync`).
2. Create `drift-detection-gate.ts`.
3. Create `handlers/manual-change-assessment.ts`.
4. Create `orchestrator/prompts/manual_change_assessment.ts`.
5. Modify `types.ts` — add `manual_change_assessment` to `StateName`.
6. Modify `handlers/index.ts` — register handler.
7. Modify `orchestrator/prompts/index.ts` — register prompt builder.
8. Modify `run-tick.ts` — wire gate into pre-tick chain.
9. Write `test/drift-detection-gate.test.mjs`.
10. Run `bun run --cwd packages/haiku test`, biome lint, tsc check.
11. Fix any failures.
12. Commit.

---

## 11. Completion Criteria Check

- [ ] `drift-detection-gate.ts` exports `runDriftDetectionGate` and typed result.
- [ ] `run-tick.ts` invokes gate after feedback-triage, short-circuits on findings.
- [ ] All 19 scenarios covered by passing assertions.
- [ ] Existing tick tests pass (no regressions).
- [ ] Biome, tsc, and bun test all pass.
- [ ] No placeholders.
