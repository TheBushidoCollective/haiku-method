---
title: Inception coverage review-agent for the design stage
model: sonnet
depends_on: []
inputs:
  - intent.md
  - knowledge/ARCHITECTURE.md
  - plugin/studios/ARCHITECTURE.md
  - plugin/studios/software/stages/design/STAGE.md
  - plugin/studios/software/stages/design/review-agents
  - plugin/studios/software/stages/inception/discovery/DISCOVERY.md
  - plugin/studios/software/stages/inception/outputs/KNOWLEDGE.md
  - packages/haiku/src/studio-reader.ts
outputs:
  - plugin/studios/software/stages/design/review-agents/inception-coverage.md
quality_gates:
  - name: review-agent-file-exists
    command: >-
      [ -f
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
      ]
  - name: review-agent-enumerates-knowledge-dir
    command: >-
      grep -qE 'knowledge/'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: review-agent-names-decision-role
    command: >-
      grep -qiE 'decision'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: review-agent-names-open-question-role
    command: >-
      grep -qiE 'open.question|unresolved.question'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: review-agent-names-ui-surface-role
    command: >-
      grep -qiE 'ui.surface|affected.surface|surface'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: review-agent-short-circuits-on-missing-inception
    command: >-
      grep -qiE 'short.circuit|skip|absent|no.inception|no.knowledge'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: haiku-tests-still-pass
    command: cd packages/haiku && node test/run-all.mjs
  - name: biome-lint-clean
    command: bun x biome check plugin/studios/software/stages/design/
status: completed
bolt: 5
hat: reviewer
started_at: '2026-04-28T21:57:40Z'
hat_started_at: '2026-04-28T23:44:16Z'
iterations:
  - hat: planner
    started_at: '2026-04-28T21:57:40Z'
    completed_at: '2026-04-28T22:04:05Z'
    result: advance
  - hat: builder
    started_at: '2026-04-28T22:04:05Z'
    completed_at: '2026-04-28T22:09:10Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:09:10Z'
    completed_at: '2026-04-28T22:13:05Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:13:05Z'
    completed_at: '2026-04-28T22:18:32Z'
    result: reject
    reason: >-
      auto-reject: quality_gate_failed (haiku-tests-still-pass,
      biome-lint-clean)
  - hat: builder
    started_at: '2026-04-28T22:18:32Z'
    completed_at: '2026-04-28T22:37:38Z'
    result: reject
    reason: 'auto-reject: quality_gate_failed (haiku-tests-still-pass)'
  - hat: builder
    started_at: '2026-04-28T22:37:38Z'
    completed_at: '2026-04-28T23:44:16Z'
    result: advance
  - hat: reviewer
    started_at: '2026-04-28T23:44:16Z'
    completed_at: '2026-04-28T23:46:50Z'
    result: advance
completed_at: '2026-04-28T23:46:50Z'
---
## Goal

Close issue #263 item 2 by adding an **inception-coverage** review-agent under the design stage's `review-agents/` directory. The agent runs in the design stage's review phase and audits produced artifacts against whatever inception artifacts exist in this intent — decisions, open-questions resolutions, UI-surface coverage. Findings emit feedback through the standard `haiku_feedback` channel; unresolved coverage gaps block the gate.

This is intentionally a **review-agent**, not a verifier hat, because the audit must read **cross-stage artifacts** (inception outputs while sitting in the design stage). Per `plugin/studios/ARCHITECTURE.md` §3.4, verifier hats are body-only — they cannot reach into other stages. Review-agents have full read access across the intent and are the canonical home for cross-stage audits.

## Files Touched

| Action | Path | Role |
|---|---|---|
| Create | `plugin/studios/software/stages/design/review-agents/inception-coverage.md` | Review-agent prompt: walk inception artifacts, diff against design output |

No `STAGE.md` edit needed — `readReviewAgentPaths` in `packages/haiku/src/studio-reader.ts:126-141` enumerates every `.md` under `review-agents/` automatically.

## Important: inception artifacts are content-named, not template-named

Spec-review surfaced a real risk: there is no `DECISIONS.md`, `OPEN-QUESTIONS.md`, or `UI-SURFACES.md` discovery template in `plugin/studios/software/stages/inception/`. Inception's only discovery template is `DISCOVERY.md` (one freeform doc covering the four content-guide subsections — Business Context, Competitive Landscape, Considerations & Risks, UI Impact). Real intents may consolidate everything into `DISCOVERY.md`, may split into per-topic files with arbitrary names, or may produce additional ad-hoc artifacts.

The review-agent therefore **MUST** discover artifacts dynamically rather than open hardcoded paths. The grep-based gates in this unit enforce that: the agent prompt must mention enumerating `knowledge/`, must name the three coverage roles (decisions, open-questions, ui-surfaces) so it knows what to look for, and must include a short-circuit branch for the case when inception was not run.

## Review-agent prompt requirements

The prompt must instruct the agent to:

1. **Discover inception artifacts dynamically** — do not hardcode paths.
   - Enumerate every file under `.haiku/intents/{slug}/knowledge/` and `.haiku/intents/{slug}/stages/inception/` (if either exists).
   - Read each file in full. Classify by content / heading scan, not by filename:
     - **Decisions** — any heading or section text containing "decision", "decided", "resolved", or `## Decisions`.
     - **Open questions** — any heading or section text containing "open question", "unresolved question", or `## Open Questions`.
     - **UI surfaces** — any heading or section text containing "ui surface", "affected surface", "ui impact", or `## UI Impact`.
     - **Constraints / risks** — any explicit constraint or risk statement.
   - When `DISCOVERY.md` is the only file, all four roles will be subsections within it; the agent extracts them by section, not by file.

2. **Short-circuit on missing inception.** If neither `.haiku/intents/{slug}/knowledge/` nor `.haiku/intents/{slug}/stages/inception/` has any files, emit a single info-severity note ("Inception not run for this intent — coverage audit skipped") and return cleanly with no blocking findings. This makes the agent safe to register globally without breaking single-stage / quick-mode intents.

3. **Read design-stage outputs**:
   - `.haiku/intents/{slug}/stages/design/artifacts/` (every file)
   - `.haiku/intents/{slug}/stages/design/DESIGN-BRIEF.md` if present

4. **Emit findings as feedback** via `haiku_feedback` for each of these failure modes (when inception artifacts ARE present):
   - **Decision violation** — design contradicts a decision the agent extracted from inception. Severity: blocker.
   - **Surface gap** — a UI surface listed in inception is not represented in the design artifacts. Severity: blocker.
   - **Resolved-question regression** — design re-introduces an answer that was settled. Severity: blocker.
   - **Scope creep** — design covers a surface or feature inception did NOT list. Severity: warning (may be legitimate but needs human triage).

5. **Cite specifics** — every finding body must include:
   - The inception artifact path + line range (or "(decision: <text>)" for an inline-extracted decision)
   - The design artifact path + line range (or screen ID) where the violation occurs
   - One-line "what to do" recommendation (revisit inception, revise design, or escalate)

6. **Anti-patterns (RFC 2119)**:
   - `MUST NOT` hardcode artifact filenames — discover them dynamically each run
   - `MUST NOT` summarize inception artifacts — read them in full per audit pass
   - `MUST NOT` infer coverage from titles or filenames — diff actual content
   - `MUST NOT` flag scope-creep without naming the specific inception artifact passage that omits the surface
   - `MUST` short-circuit cleanly when inception is absent

## Why this isn't a hat

Quoting `plugin/studios/ARCHITECTURE.md` §3.4: verifier hats are body-only. Inception-coverage by definition reads other stages' artifacts. Putting it inside a hat would either (a) require widening the hat's read scope (architectural drift) or (b) silently fail when the audit needs cross-stage data. Review-agents already have the right scope.

## Completion criteria

Each criterion is paired with the executable gate that proves it. Gates live in this unit's `quality_gates:` frontmatter.

1. **The review-agent file exists.**
   - `review-agent-file-exists` — `[ -f plugin/studios/software/stages/design/review-agents/inception-coverage.md ]`

2. **The agent's prompt instructs dynamic enumeration of `knowledge/` rather than hardcoded paths.**
   - `review-agent-enumerates-knowledge-dir` — `grep -qE 'knowledge/' plugin/studios/software/stages/design/review-agents/inception-coverage.md`

3. **The prompt names the three coverage roles** so the agent knows what content patterns to look for.
   - `review-agent-names-decision-role` — `grep -qiE 'decision' ...`
   - `review-agent-names-open-question-role` — `grep -qiE 'open.question|unresolved.question' ...`
   - `review-agent-names-ui-surface-role` — `grep -qiE 'ui.surface|affected.surface|surface' ...`

4. **The prompt includes a short-circuit for absent inception artifacts** so single-stage / quick-mode intents are not blocked by a coverage check that has nothing to compare against.
   - `review-agent-short-circuits-on-missing-inception` — `grep -qiE 'short.circuit|skip|absent|no.inception|no.knowledge' ...`

5. **The full haiku MCP test suite still passes** — `readReviewAgentPaths` discovery doesn't regress.
   - `haiku-tests-still-pass` — `cd packages/haiku && node test/run-all.mjs`

6. **Design stage content lints clean.**
   - `biome-lint-clean` — `bun x biome check plugin/studios/software/stages/design/`

## Out of scope

- Adding the same review-agent to other stages (e.g. development against design coverage). That's a separate intent if desired.
- Adding a new studio-level intent-completion review for inception coverage. The pre-tick triage gate already covers cross-stage feedback routing once the agent fires findings.
- Standardizing inception artifact filenames (e.g. mandating `DECISIONS.md` / `OPEN-QUESTIONS.md` as discovery templates). That's a heavier inception-side intent; this review-agent is designed to work without it via dynamic discovery.
- Changing the inception researcher hat to emit content-tagged sections in a machine-parseable shape. The review-agent's content-scan approach is robust to inception's existing freeform output.
