# H·AI·K·U Project

H·AI·K·U = Human + AI Knowledge Unification — a universal lifecycle framework for structured AI-assisted work.

Three-component project: **plugin** (Claude Code plugin), **paper** (methodology spec), **website** (Next.js 15 static site).

- Paper is the source of truth for methodology concepts
- Plugin is the source of truth for implementation (orchestrator, MCP tools, hooks, runtime behavior)
- **`plugin/studios/ARCHITECTURE.md` is the structural reference for studio/stage/unit/hat/feedback boundaries within the plugin** — the rules and contracts that apply across studios, distinct from any single implementation file. Read it before structural changes; conflict resolution between this doc and the plugin code is described in the doc's intro.
- Website presents all of the above to users

## Sync Discipline (CRITICAL)

When modifying any component, check if other components need corresponding updates:

| Change Type | Paper | Plugin | Website |
|---|---|---|---|
| New prompt | Mention in relevant section | Add handler in `prompts/*.ts` | Update docs if user-facing |
| New studio | Document in Profiles section | Primary | Update docs |
| New stage | Document in relevant profile | Primary | Update docs |
| New hat (in stage) | Document in relevant profile | Add `hats/{hat}.md` file in stage directory | Update docs if user-facing |
| New review agent (in stage) | Document in Quality Enforcement | Add `review-agents/{agent}.md` file in stage directory (resolved via 3-tier cascade — see "Hat / review-agent cascade" below) | Update docs if user-facing |
| New fix hat (in stage) | Mention in Fix Loop section | Add `hats/{hat}.md` file in stage directory + reference in `fix_hats:` on STAGE.md | Update docs if user-facing |
| New studio-level intent-completion review agent | Mention in Intent-Completion Review section | Add `intent-review-agents/{agent}.md` file in studio directory (NOT per-stage). Directory was renamed from `review-agents/` 2026-05-18 so the studio-level slot in the stage cascade is free | Update docs if user-facing |
| New global hat / review agent (any studio) | Document if added | Add to `plugin/hats/{hat}.md` or `plugin/review-agents/{agent}.md` — resolved by every stage in every studio unless a more-specific tier overrides | Update docs if user-facing |
| New studio-level fix hat | Mention in Intent-Completion Review section | Add `fix-hats/{hat}.md` file in studio directory (NOT per-stage) | Update docs if user-facing |
| New phase override (in stage) | Mention in Stages section if needed | Add `phases/{PHASE}.md` file in stage directory | Update docs if user-facing |
| New operation template | Document in Operation phase | Add `operations/{op}.md` file in studio directory | Update docs if user-facing |
| New reflection dimension | Document in Reflection phase | Add `reflections/{dim}.md` file in studio directory | Update docs if user-facing |
| New lifecycle phase | Document as new section | Implement | Update docs |
| Terminology change | Update all references | Update all references | Update all references |
| New principle | Document in Principles section | Implement if applicable | Update if referenced |
| Concept refinement | Update definition | Update implementation | Update docs |
| Persistence change | N/A (environment-detected) | Update state-tools.ts isGitRepo | Update docs if user-facing |
| New harness support | N/A | Add entry to HARNESS_REGISTRY in `harness.ts`, update rewriting rules in `harness-instructions.ts` | Update docs if user-facing |

## Key File Locations

- Paper: `website/content/papers/haiku-method.md`
- Plugin metadata: `plugin/.claude-plugin/plugin.json`
- Plugin prompts: `packages/haiku/src/prompts/*.ts` (MCP prompt handlers — all behavior lives here)
- Plugin studios: `plugin/studios/*/STUDIO.md`
- Plugin stages: `plugin/studios/*/stages/*/STAGE.md`
- Plugin hats (stage tier): `plugin/studios/*/stages/*/hats/*.md`
- Plugin hats (studio tier): `plugin/studios/*/hats/*.md`
- Plugin hats (global tier): `plugin/hats/*.md` (classifier, feedback-assessor)
- Plugin review agents (stage tier): `plugin/studios/*/stages/*/review-agents/*.md`
- Plugin review agents (studio tier): `plugin/studios/*/review-agents/*.md`
- Plugin review agents (global tier): `plugin/review-agents/*.md`
- Plugin phase overrides: `plugin/studios/*/stages/*/phases/*.md`
- Plugin operations: `plugin/studios/*/operations/*.md`
- Plugin reflections: `plugin/studios/*/reflections/*.md`
- Plugin studio-level intent-completion review agents: `plugin/studios/*/intent-review-agents/*.md`
- Plugin studio-level fix hats (intent-completion fix loop): `plugin/studios/*/fix-hats/*.md`
- Plugin intent templates: `plugin/studios/*/templates/*.md`
- Plugin hooks: `plugin/hooks/*.sh` + `plugin/.claude-plugin/hooks.json`
- Plugin libraries: `plugin/lib/*.sh`
- Plugin orchestration: `plugin/lib/orchestrator.sh`, `plugin/lib/stage.sh`, `plugin/lib/studio.sh`
- Plugin environment detection: `packages/haiku/src/state-tools.ts` (isGitRepo)
- Plugin harness support: `packages/haiku/src/harness.ts` (capability registry), `packages/haiku/src/harness-instructions.ts` (instruction adaptation)
- Plugin providers: `plugin/providers/*.md` (bidirectional translation instructions) + `plugin/schemas/providers/*.json`
- Website docs: `website/content/docs/`
- Infrastructure: `deploy/terraform/`
- Changelog: `CHANGELOG.md` (Keep a Changelog format)

## Concept-to-Implementation Mapping

| Concept | Paper Section | Plugin Implementation | Key Files |
|---|---|---|---|
| Intent | Elaboration phase | `.haiku/intents/{slug}/intent.md` | prompts/core.ts |
| Unit | Elaboration phase | `.haiku/intents/{slug}/stages/{stage}/units/unit-NN-*.md` | prompts/core.ts |
| Bolt | Execution phase | `iteration` field in iteration.json | orchestrator.ts |
| Studio | Profiles section | `plugin/studios/{name}/STUDIO.md` | studio.sh |
| Stage | Profiles section | `plugin/studios/{name}/stages/{stage}/STAGE.md` | stage.sh, orchestrator.ts |
| Hat | Profiles section | Three-tier cascade (more-specific wins): `plugin/hats/{hat}.md` → `plugin/studios/{name}/hats/{hat}.md` → `plugin/studios/{name}/stages/{stage}/hats/{hat}.md`. Project `.haiku/` overrides plugin at each tier. Resolver: `readHatDefs` / `resolveHatPath` in `studio-reader.ts` | studio-reader.ts |
| Review Agent | Quality Enforcement | Three-tier cascade (more-specific wins): `plugin/review-agents/{agent}.md` → `plugin/studios/{name}/review-agents/{agent}.md` → `plugin/studios/{name}/stages/{stage}/review-agents/{agent}.md`. Project `.haiku/` overrides plugin at each tier. Resolver: `readReviewAgentDefs` / `readReviewAgentPaths` in `studio-reader.ts`. Configured agents fire in BOTH stage walks: `dispatch_review` (pre-execute, audits spec) and `dispatch_approval` (post-execute, audits work) | studio-reader.ts |
| Reviews vs Approvals (stage) | N/A | Reviews are PRE-execute (`dispatch_review` walk fires between `elaborate_loop` completion and wave-ready hat dispatch — audits the SPEC). Approvals are POST-execute (`dispatch_approval` walk fires after all units' hat sequences complete — audits the WORK). Engine roles (spec, continuity, cross-stage-consistency) fire in BOTH with phase-appropriate mandate bodies in sibling `engine-bodies/` dirs. Per-unit `reviews.*` and `approvals.*` FM stamps mirror the split | orchestrator/workflow/cursor.ts |
| Spec Review (engine phase) | Quality Enforcement | Universal hard gate that always fires between `execute` and the parallel quality review on every stage. Engine-owned: built-in spec-conformance prompt lives in `prompts/spec_review.ts`, no per-studio mandate file, no opt-out — every intent has a spec, every stage produces something the intent scoped, so every stage benefits. State tracked via `spec_review_dispatched` + `quality_review_dispatched` in stage state.json | `handlers/review.ts`, `handlers/gate.ts`, `prompts/spec_review.ts` |
| Fix Hats | Fix Loop | `fix_hats:` frontmatter on STAGE.md (ordered hat list dispatched against open feedback — typically ends with `feedback-assessor`) | orchestrator.ts (`resolveStageFixHats`, `review_fix` action) |
| Feedback Assessor | Fix Loop | Terminal hat in `fix_hats` that independently decides closure — `plugin/studios/{name}/stages/{stage}/hats/feedback-assessor.md` | orchestrator.ts |
| Studio Review Agent | Intent-Completion Review | `plugin/studios/{name}/intent-review-agents/{agent}.md` (NOT per-stage). Runs by default after final stage gate; opt out with `intent_completion_review: false` on intent frontmatter. Directory was renamed from `review-agents/` 2026-05-18 to free the studio-tier slot in the stage-review cascade | orchestrator.ts (`runIntentCompletionReview`, `readStudioReviewAgentPaths`) |
| Studio Fix Hat | Intent-Completion Review | `plugin/studios/{name}/fix-hats/{hat}.md` (NOT per-stage) — dispatched against intent-scope feedback | orchestrator.ts (`intent_completion_fix` action, `readStudioFixHatPaths`) |
| Feedback Triage | Quality Enforcement | `triaged_at:` on feedback frontmatter — pre-tick gate (`feedback-triage-gate.ts`) classifies open FBs before any handler dispatch; cross-stage findings are relocated via `haiku_feedback_move` rather than carrying a stage hint | state-tools.ts, orchestrator/workflow/feedback-triage-gate.ts |
| Phase Override | Stages section | `plugin/studios/{name}/stages/{stage}/phases/{PHASE}.md` | orchestrator.ts |
| Review Gate | Quality Enforcement | `review:` field in STAGE.md — `auto` (harness advances), `ask` (local human approval), `external` (blocks for external review system), `await` (blocks for external event), or compound list like `[external, ask]` (user chooses path) | orchestrator.ts |
| Operation Template | Operation phase | `plugin/studios/{name}/operations/{op}.md` | prompts/complex.ts |
| Reflection Dimension | Reflection phase | `plugin/studios/{name}/reflections/{dim}.md` | prompts/core.ts |
| Completion Criteria | Throughout | `quality_gates:` in unit/intent frontmatter, harness-enforced | orchestrator.ts, quality-gate.sh |
| Backpressure | Principles section | Quality gates enforced by harness, not agent | quality-gate.sh, orchestrator.ts |
| Operating Modes | Operating Modes section | interactive=HITL, /haiku:pickup=OHOTL, /haiku:autopilot=AHOTL | prompts/core.ts, prompts/complex.ts |
| Hard Gates | Execution phase | exit code enforcement in quality-gate.sh | orchestrator.ts |
| Persistence | Context Preservation | Environment-detected via `isGitRepo()` (git or filesystem) | state-tools.ts, git-worktree.ts |
| Providers | Memory Providers section | `plugin/schemas/providers/*.json`, `plugin/providers/*.md` | config.sh |
| Harness | N/A (implementation detail) | `--harness <name>` MCP arg or `HAIKU_HARNESS` env var; capability registry in `harness.ts`, instruction adaptation in `harness-instructions.ts` | harness.ts, harness-instructions.ts, orchestrator.ts, server.ts |
| Operations | Operation phase | /haiku:operate prompt | prompts/complex.ts |
| Architecture (canonical) | N/A — implementation reference | `plugin/studios/ARCHITECTURE.md` — boundaries, lifecycle, hat patterns, FB-as-unit fix-loop semantics. Read before any structural change to studios, stages, hats, or workflow tools | ARCHITECTURE.md |
| Workflow-managed file boundary | Quality Enforcement | PreToolUse hook denies generic Read/Write/Edit on `units/*.md`, `feedback/*.md`, `intent.md`, `stages/*/state.json`. Agents go through MCP tools only; redirect messages name the right tool | hooks/guard-workflow-fields.ts |
| Unit CRUDL (MCP) | N/A — implementation | `haiku_unit_write` (create/rewrite, FM validators, DAG cycle detection, pending-only lifecycle), `haiku_unit_read` (body+title only — no FM exposed), `haiku_unit_set` (FM field update, lifecycle-enforced), `haiku_unit_delete` (pending only), `haiku_unit_list` | state-tools.ts |
| Feedback CRUDL (MCP) | N/A — implementation | `haiku_feedback_write` (body update, lifecycle-enforced), `haiku_feedback_read` (body+title only), `haiku_feedback` (create), `haiku_feedback_update` (status transitions, terminal-state-protected), `haiku_feedback_reject` (mark invalid), `haiku_feedback_delete`, `haiku_feedback_list` | state-tools.ts |
| FB-as-unit fix loop | Fix Loop / architecture §5 | Fixer hats edit the FB body via `haiku_feedback_write`; flagged units are read-only via `haiku_unit_read`. Hat progression via `haiku_feedback_advance_hat` / `haiku_feedback_reject_hat` (mirrors of unit equivalents). The workflow auto-closes the FB when the last hat in `fix_hats:` calls advance. Closed FBs become input to the next iteration of the upstream stage's elaborate phase, which authors corrective work — completed units are never modified (forward-only lifecycle) | state-tools.ts (`haiku_feedback_advance_hat`, `haiku_feedback_reject_hat`), orchestrator.ts (`review_fix`, `intent_completion_fix` dispatches) |
| Verifier hat | architecture §3 (plan-do-verify) | Terminal hat in every per-unit hat sequence. Body-only mandate (FM is workflow-engine territory). Validates substance, citation, internal consistency, decision-register consistency. Calls `haiku_unit_advance_hat` on pass, `haiku_unit_reject_hat` on fail | plugin/studios/{studio}/stages/{stage}/hats/verifier.md |
| View session (MCP) | N/A — implementation | `haiku_view` (open tunneled URL — boot mode spawns the project's dev/start script on an ephemeral port, viewer mode points at the SPA artifact-browser route at `/view/<sessionId>?artifact=<path>&stage=<stage>`; mode auto-detects with explicit `mode: "boot"`/`"viewer"` overrides), `haiku_view_close` (explicit shutdown of view session + spawned dev server). Lifecycle: explicit close, 30min TTL, tick-scoped orphan sweep via `killAllOrphanedBootSessions` in `run-tick.ts`. Consumed by any review-agent (or other tool-using agent) that wants to drive a real browser at a rendered artifact or a booted app; per-studio mandate files (e.g. `runtime-verifier.md`) are where studios opt into using it. | view-boot.ts, sessions.ts (`ViewSession`), http/session-routes.ts (`/view/:sessionId`), http/file-serve.ts (extended `/stage-artifacts/:sessionId/*` to allow view sessions) |
| Prompts cascade | N/A — implementation | Engine prompt templates (`.eta.md`) live at `plugin/prompts/<rel>/<name>` (single source of truth, shipped with the plugin). `loadTemplate` in `_load-template.ts` resolves them through a two-tier cascade: project override at `.haiku/prompts/<rel>/<name>` wins over plugin default at `<pluginPromptsRoot>/<rel>/<name>`. Build-time `canonicalize-prompt-templates.mjs` esbuild plugin rewrites `loadTemplate(import.meta.url, …)` call sites in the TS builders under `packages/haiku/src/orchestrator/prompts/` to a `"@canon:<rel>"` sentinel form — no copy step, the bundle just needs sentinel-form lookups to avoid reading its own `import.meta.url` at runtime. Replaces the older inline-string + copy-to-`plugin/templates/` approach so teams can override engine prompts locally without forking the plugin, and the plugin tree stays the canonical home for prompt bodies. | packages/haiku/src/orchestrator/prompts/_load-template.ts (loader cascade), packages/haiku/scripts/canonicalize-prompt-templates.mjs (build-time sentinel rewrite + existence check), plugin/prompts/ (source of truth), plugin/package.json (`files: [...]` includes `prompts`) |
| Observations + reflection | N/A — implementation | Default-on reflection loop. At each stage close, cursor emits `record_observations` so the agent writes a free-form `.haiku/intents/<slug>/stages/<stage>/observations.md` capturing out-of-band churn (mandate ambiguity, engine friction, surprises) the FB stream / outputs / iterations don't already show. At intent close, cursor emits `record_reflection` so the agent reads all stage observations + FBs + iterations + outputs and writes a synthesized `.haiku/intents/<slug>/reflection.md`, lands any override-class findings as project overlays directly under `.haiku/...` (cascade picks them up next tick, no rebuild), and reports engine-class findings via the existing `haiku_report` tool (Sentry pipeline, message prefixed `[autotune engine-class]`). All changes commit with an `autotune:` prefixed message — PR review is the human gate, no FB queue, no tune dashboard. Opt-out via `reflection: false` on intent.md FM (backward-compat: `autotune: false` still respected). | prompts/stage/complete/record_observations, prompts/intent/reflection/record_reflection, cursor.ts (`isReflectionEnabled`) |
| Playwright MCP | N/A — bundled tool | `@playwright/mcp` shipped in `plugin/.mcp.json` with `--headless` always-on so dispatch is non-interactive. Available to every agent; per-studio mandates decide how to use it. | plugin/.mcp.json |

## H·AI·K·U Terminology (CRITICAL)

| H·AI·K·U Term | Agile Equivalent | Description |
|---|---|---|
| Intent | Feature / Epic | The overall thing being built |
| Unit | Ticket / Story | A discrete piece of work within an intent |
| Bolt | Sprint | The iteration cycle an agent runs within a unit |
| Studio | (no equivalent) | A named lifecycle template (profile implementation) containing stages |
| Stage | (no equivalent) | A lifecycle phase within a studio, containing hats and review gates |
| Hat | Role | A behavioral role scoped to a stage, defined in `hats/{hat}.md` files within the stage directory |
| Review Gate | Quality Gate | A checkpoint between stages controlling advancement. `auto` = harness-only (no human). `ask` = local review UI, human approves/rejects via MCP response. `external` = blocks until external system (GitHub/GitLab) approves; signal detected primarily by branch merge detection, with URL-based CLI probing as fallback. `await` = blocks until an external event occurs (not a review — e.g., customer response, pipeline). Compound: `[external, ask]` = user chooses between external submission or local approval. |

### Hierarchy

```
Studio > Stage > Unit > Bolt
```

- **Studio** is NOT the same as Stage. Studio = the lifecycle template. Stage = a phase within it.
- **Unit** is NOT the same as Bolt. Unit = the work itself. Bolt = the iteration cycle within a unit.
- **Hat** is always scoped to a Stage, defined in `stages/{stage}/hats/{hat}.md` files. Project-level augmentation: `.haiku/studios/{studio}/stages/{stage}/hats/{hat}.md`.

## Version Management

- Plugin version in `plugin/.claude-plugin/plugin.json` -- auto-bumped by CI
- Changelog follows Keep a Changelog format at repo root
- Website deploys on push to main when `website/` changes
