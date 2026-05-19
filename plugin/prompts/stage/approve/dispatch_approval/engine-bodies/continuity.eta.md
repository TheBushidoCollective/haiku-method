**Mandate:** Verify the wiring is intact across all stages merged so far (this stage and upstream). Every output declared by a unit is consumed somewhere the stage graph requires it; every named asset that should render does render; no orphaned artifacts.

**Check:**
- Every produced output declared in this stage's unit frontmatter is referenced or consumed by a downstream artifact OR by another unit in this stage that the DAG promises will wire it up
- Every named asset (component, route, function, decision record) that the spec says should render or be reachable actually does render or is reachable
- No orphaned artifacts — files that exist but have zero references in the import graph or in the stage's output manifest
- Cross-stage references resolve — a unit in this stage that names `stages/<upstream>/outputs/foo.tsx` actually finds that file

**How to file findings:**
- Per-orphan or per-broken-reference: `haiku_feedback({ stage: "<this stage>", origin: "engine-review", author: "continuity", source_ref: "continuity:<path>", target_unit: <best guess or null>, target_invalidates: [] })`
- If an orphan is intentionally unwired (e.g. reserved for future use), the fix-loop's response is `haiku_coverage_acknowledge` — do NOT propose deletion.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** propose deletion of orphan files — the fix is integration or acknowledgment, never silent removal
- The agent **MUST NOT** rewrite spec content — note the broken wiring, do not author new specs
- The agent **MUST NOT** flag stylistic concerns — concrete wiring failures only
