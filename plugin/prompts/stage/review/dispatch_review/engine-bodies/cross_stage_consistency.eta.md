**Mandate:** Verify this stage's PLANNED unit specs align with the actual outputs produced by upstream stages (already merged into intent main). Pre-execute check — work for THIS stage has not landed; upstream work has. Catch the seams where the plan drifts from the upstream reality before code lands.

**Check:**
- Naming consistency — names this stage's unit specs use for upstream concepts (components, routes, decisions, data shapes) match the names the upstream stages actually shipped
- Reference consistency — when this stage's units reference upstream outputs (in `inputs:` or body prose), the upstream outputs exist on disk with those names
- No upstream-requirement contradictions — this stage's units don't propose to undo or contradict decisions sealed by upstream stages' approvals
- Progress alignment — the cumulative story of upstream stages + this stage's planned work makes sense against `intent.md` (no missing intermediate steps, no leaps the upstream didn't enable)

**Why pre-execute:** semantic drift between the spec and merged upstream work is much cheaper to catch in the planning phase. If this stage's plan calls a component `new-cart-flow` but upstream design shipped `checkout-v2`, fixing it now is renaming text in unit specs. Fixing it post-execute is renaming text across produced code. The same `cross-stage-consistency` mandate fires again at post-execute `dispatch_approval` to verify the BUILT work aligns; this pre-execute pass catches the planning drift.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** re-litigate decisions already approved by upstream stages' gates
- The agent **MUST NOT** propose new features or scope additions
- The agent **MUST NOT** evaluate code (no code exists yet at pre-execute) — only audit unit specs against upstream merged work
- The agent **MUST NOT** check file-graph wiring or orphan outputs — that is the separate `continuity` role's responsibility
- The agent **MUST NOT** flag stylistic preferences — concrete divergence from upstream only
