---
title: Inception coverage review-agent for the design stage
model: sonnet
depends_on: []
outputs:
  - plugin/studios/software/stages/design/review-agents/inception-coverage.md
quality_gates:
  - name: review-agent-file-exists
    command: >-
      [ -f
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
      ]
  - name: review-agent-cites-decisions
    command: >-
      grep -q 'DECISIONS.md'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: review-agent-cites-open-questions
    command: >-
      grep -q 'OPEN-QUESTIONS'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: review-agent-cites-ui-surfaces
    command: >-
      grep -q 'UI-SURFACES'
      plugin/studios/software/stages/design/review-agents/inception-coverage.md
  - name: haiku-tests-still-pass
    command: cd packages/haiku && node test/run-all.mjs
  - name: biome-lint-clean
    command: bun x biome check plugin/studios/software/stages/design/
status: pending
inputs: >-
  ["intent.md", "knowledge/ARCHITECTURE.md", "plugin/studios/ARCHITECTURE.md",
  "plugin/studios/software/stages/design/STAGE.md",
  "plugin/studios/software/stages/design/review-agents",
  "plugin/studios/software/stages/inception/outputs/KNOWLEDGE.md",
  "packages/haiku/src/studio-reader.ts"]
---
## Goal

Close issue #263 item 2 by adding an **inception-coverage** review-agent under the design stage's `review-agents/` directory. The agent runs in the design stage's review phase and audits produced artifacts against inception's authoritative artifacts: `DECISIONS.md` resolutions, `OPEN-QUESTIONS.md` resolved items, and the `UI-SURFACES.md` requirements list. Findings emit feedback through the standard `haiku_feedback` channel; unresolved coverage gaps block the gate.

This is intentionally a **review-agent**, not a verifier hat, because the audit must read **cross-stage artifacts** (inception outputs while sitting in the design stage). Per `plugin/studios/ARCHITECTURE.md` §3.4, verifier hats are body-only — they cannot reach into other stages. Review-agents have full read access across the intent and are the canonical home for cross-stage audits.

## Files Touched

| Action | Path | Role |
|---|---|---|
| Create | `plugin/studios/software/stages/design/review-agents/inception-coverage.md` | Review-agent prompt: walk inception artifacts, diff against design output |

No STAGE.md edit needed — `readReviewAgentPaths` in `packages/haiku/src/studio-reader.ts:126-141` enumerates every `.md` under `review-agents/` automatically.

## Review-agent prompt requirements

The prompt must instruct the agent to:

1. **Read inception artifacts in this order** (cite the canonical paths so the agent does not paraphrase):
   - `.haiku/intents/{slug}/knowledge/DECISIONS.md` — every resolved decision is a hard constraint on design
   - `.haiku/intents/{slug}/knowledge/OPEN-QUESTIONS.md` — resolved items have answers; design must reflect them
   - `.haiku/intents/{slug}/knowledge/UI-SURFACES.md` (or whichever doc inception emitted listing user-facing surfaces) — every surface listed is a coverage line item

2. **Read design-stage outputs**:
   - `.haiku/intents/{slug}/stages/design/artifacts/` (every file)
   - `.haiku/intents/{slug}/stages/design/DESIGN-BRIEF.md`

3. **Emit findings as feedback** via `haiku_feedback` for each of these failure modes:
   - **Decision violation** — design contradicts a resolved decision in `DECISIONS.md`. Severity: blocker.
   - **Surface gap** — a UI surface listed in inception is not represented in the design artifacts. Severity: blocker.
   - **Resolved-question regression** — design re-introduces an answer that `OPEN-QUESTIONS.md` already settled. Severity: blocker.
   - **Scope creep** — design covers a surface or feature inception did NOT list. Severity: warning (may be legitimate but needs human triage).

4. **Cite specifics** — every finding body must include:
   - The inception artifact path + line range (or "(decision: <text>)" for `DECISIONS.md` items)
   - The design artifact path + line range (or screen ID) where the violation occurs
   - One-line "what to do" recommendation (revisit inception, revise design, or escalate)

5. **Anti-patterns (RFC 2119)**:
   - `MUST NOT` summarize inception artifacts — read them in full per audit pass
   - `MUST NOT` infer coverage from titles or filenames — diff actual content
   - `MUST NOT` flag scope-creep without naming the specific inception artifact that omits the surface

## Why this isn't a hat

Quoting `plugin/studios/ARCHITECTURE.md` §3.4: verifier hats are body-only. Inception-coverage by definition reads other stages' artifacts. Putting it inside a hat would either (a) require widening the hat's read scope (architectural drift) or (b) silently fail when the audit needs cross-stage data. Review-agents already have the right scope.

## Completion criteria

1. The review-agent file exists and is well-formed markdown.
   - Verified by gate `review-agent-file-exists`.
2. The agent's prompt explicitly names the three canonical inception artifacts (`DECISIONS.md`, `OPEN-QUESTIONS.md`, `UI-SURFACES`) so the agent reads source rather than paraphrasing.
   - Verified by gates `review-agent-cites-decisions`, `review-agent-cites-open-questions`, `review-agent-cites-ui-surfaces`.
3. The full haiku MCP test suite still passes — `readReviewAgentPaths` discovery doesn't regress.
   - Verified by gate `haiku-tests-still-pass`.
4. Design stage content lints clean.
   - Verified by gate `biome-lint-clean`.

## Out of scope

- Adding the same review-agent to other stages (e.g. development against design coverage). That's a separate intent if desired.
- Adding studio-level intent-completion review for inception coverage. The pre-tick triage gate already covers cross-stage feedback routing once the agent fires findings.
- Inception-side artifact format changes (`DECISIONS.md` structure, etc.). This unit assumes the existing format.
