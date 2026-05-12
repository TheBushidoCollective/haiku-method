# Polish Stage — Execution

## Per-unit baton (`gameplay-engineer → tuner → performance-engineer → qa`)

Every polish unit walks the four hats in order. The baton is the unit body, accumulating each hat's deliverable section:

1. **`gameplay-engineer` (plan + do-fix):** Triages the inbound bug list (P0 / P1 / P2 / P3), reproduces each bug, and applies surgical fixes — no refactoring, no feature additions, no "while we're at it." Adds a regression test for every fix that has a shape that could recur. Appends `## Polish Fix Log` covering bug ID, severity, root cause, files touched, regression test, verified-on-build status.
2. **`tuner` (do-feel):** Tunes game feel — timing, responsiveness, juice, pacing, difficulty curves — in small increments, re-verified each round on the actual build, traced to a pillar. Integrates audio / visual / haptic feedback (juice) deliberately, with pillar adherence as the filter. Appends `## Feel Tuning Log` with per-system pillar mapping, change, evidence.
3. **`performance-engineer` (do-perf):** Profiles before changing. Identifies bottlenecks per platform (CPU frame time, GPU frame time, memory, load times, thermal sustained). Optimizes against the bottleneck, verifies the optimization didn't regress gameplay feel (coordinates with tuner hat). Hits platform minimums before pushing toward platform targets. Appends `## Performance Log` with per-platform target / baseline / change / post-change / status.
4. **`qa` (verify):** Reads the unit body and the project's bug tracker. Runs the coverage sweep across systems / content pieces / platforms / edge cases / save-load / error paths. Verifies fixes on the **release build**, not the dev branch. Appends `## QA Decision` with APPROVED / REJECTED and the responsible-hat routing for any finding.

The hat order is `plan + do-fix → do-feel → do-perf → verify` because fixes must land before tuning is meaningful (a buggy system can't be tuned reliably), tuning must land before performance optimization (perf work that breaks feel is regression), and verification is the gate before release.

## After execute completes

When every polish unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate.
2. **Quality review (parallel)** — The stage's review agents (`bug-readiness`, `performance-targets`) fire in parallel.
3. **Fix loop (if any feedback opens)** — The `fix_hats:` chain (`classifier → gameplay-engineer → feedback-assessor`) dispatches against each open feedback. Polish-fix is re-tuning, re-fixing, or re-optimizing — never adding new content. The classifier routes the FB; `gameplay-engineer` is the implementer; the assessor decides closure.
4. **Gate** — The stage's gate is `[external, ask]` — the user picks between external review (e.g., a publisher beta signoff, a platform pre-cert pass) or local approval.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Open P0 bugs at gate time** are gate-blocking — bug-readiness lens enforces this. Re-categorizing P0 to P1 to move it out of gate-blocking scope is itself a finding.
- **Performance measurements taken on developer hardware rather than platform reference hardware** hide platform-specific failures — performance-targets lens enforces measurement on reference hardware.
- **Sustained-play thermal capture omitted for handheld / mobile** is the failure mode that surprises at launch — short captures hide thermal degradation.
- **Fix verified on dev branch but not on release build** ships as a regression — silent fix-loss happens when the release build is cut before the fix merges.
- **Scope additions dressed as fixes** (UI redesigns, accessibility features, system refactors) are gate-blocking — polish is not the stage to revisit production decisions.
