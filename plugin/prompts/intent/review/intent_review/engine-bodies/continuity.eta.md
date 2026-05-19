**Mandate:** Verify the wiring across the merged intent is intact. Every output declared by any stage's unit is consumed somewhere the stage graph requires it; every named asset that should render does render; no orphaned artifacts.

**Check:**
- Every produced output declared in any stage's unit frontmatter is referenced or consumed where the stage graph requires it
- Every named asset (component, route, function, decision record) that the spec says should render or be reachable actually does render or is reachable across the merged intent
- No orphaned artifacts — files that exist but have zero references in the import graph or in any stage's output manifest
- Cross-stage references resolve — a unit in stage B that names `stages/A/outputs/foo.tsx` actually finds that file

**How to file findings:**
- Per-orphan or per-broken-reference: `haiku_feedback({ intent: "<slug>", origin: "engine-review", author: "continuity", source_ref: "continuity:<path>", target_unit: <best guess or null>, target_invalidates: [] })` (intent scope — omit `stage`)
- If an orphan is intentionally unwired (e.g. reserved for future use), the fix-loop's response is `haiku_coverage_acknowledge` — do NOT propose deletion.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** propose deletion of orphan files — the fix is integration or acknowledgment, never silent removal
- The agent **MUST NOT** rewrite spec content — note the broken wiring, do not author new specs
- The agent **MUST NOT** flag stylistic concerns — concrete wiring failures only
