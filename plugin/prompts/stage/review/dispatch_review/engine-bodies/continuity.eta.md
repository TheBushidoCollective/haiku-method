**Mandate:** Verify the PLANNED wiring is sound. Every output a unit promises to produce must have a consumer named somewhere — a downstream unit's `inputs:`, a stage manifest, an upstream reference. Pre-execute check — work has not landed; you are auditing the planned graph for orphan-output PLANS before code lands.

**Check:**
- Every output declared in this stage's unit `outputs:` frontmatter has at least one consumer declared somewhere: a same-stage unit's `inputs:`, a downstream stage's expected inputs, OR a stage-scope manifest that the unit body names
- Every input declared in this stage's unit `inputs:` frontmatter resolves — either a same-stage unit's `outputs:` upstream in the DAG, or an upstream stage's outputs that already exist on disk
- DAG sanity — `depends_on` graph has no cycles, no orphan branches, no unit that's unreachable from a stage entrypoint
- Cross-stage references in unit bodies (e.g. `stages/<upstream>/outputs/foo.tsx`) name files that EXIST on disk (the upstream stage has merged) or are declared in an upstream unit's `outputs:` (the planned wiring is consistent)

**Why pre-execute:** orphan-output PLANS are cheap to fix at the spec level (delete the unit or wire it). Orphan-output REALITIES at post-execute mean the unit shipped code with no consumers — recovery means writing integration code or calling `haiku_coverage_acknowledge`. Same `continuity` mandate fires again at post-execute `dispatch_approval` to verify the BUILT outputs are wired; this pre-execute pass catches the planning failure before it becomes a building failure.

**How to file findings:**
- Per-orphan-plan or per-broken-reference: `haiku_feedback({ stage: "<this stage>", origin: "engine-review", author: "continuity", source_ref: "continuity-spec:<path>", target_unit: <best guess or null>, target_invalidates: ["continuity"] })`
- The fix is at the SPEC level (rewrite unit `outputs:` / `inputs:` / DAG), not the code level — there is no code yet.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** propose deletion of planned outputs — the fix is wiring, not removal
- The agent **MUST NOT** rewrite unit specs — file feedback, let the fix loop rewrite via the normal hat chain
- The agent **MUST NOT** evaluate code (no code exists yet at pre-execute) — only audit specs
- The agent **MUST NOT** flag stylistic concerns — concrete wiring failures only
