## Record reflection — synthesize the run, land tuning where it belongs

Intent **<%= it.slug %>** has every intent-scope approval signed. Before the engine seals, distill the whole run into one synthesized reflection, land any project-local overlays directly on disk, and report engine-class friction to the H·AI·K·U team. The PR you're about to push is the human review surface — no FB queue, no separate tune dashboard.

## Inputs to read

All of these already exist on disk — read what's there, don't re-derive what's already captured:

- **Per-stage observations** — `.haiku/intents/<%= it.slug %>/stages/*/observations.md`. The free-form reflections the agent wrote at each stage close. These are the only inputs this pass can't see anywhere else.
- **Feedback files** — `.haiku/intents/<%= it.slug %>/[stages/*/]feedback/FB-*.md`. Every FB filed in this intent's lifetime, regardless of origin (user-chat, adversarial-review, drift, agent). FBs are the formal "this needed another turn" signal.
- **Unit iterations + outputs** — every unit's FM has `iterations: N` (bolt count) + `outputs:` list. Reading them tells you which hats took multiple bolts and which outputs landed clean on the first try.
- **Mandate files** — `plugin/hats/<hat>.md`, `plugin/studios/<studio>/hats/<hat>.md`, `plugin/studios/<studio>/stages/<stage>/hats/<hat>.md`, plus the equivalent `review-agents/` and `fix-hats/` cascades. Read the active mandate for any hat/agent that produced signal (FB, observation, high bolt count) to ground the divergence claim.

## What to produce

Three outputs land in the working tree, all in a single commit at the end:

### 1. `.haiku/intents/<%= it.slug %>/reflection.md` — required, always

A free-form synthesized recap of the run from a tuning perspective. Sections to cover:

- **Patterns across stages** — what diverged consistently, not in just one stage
- **Mandate ambiguity findings** — where multiple observations / FBs point at the same unclear mandate
- **Engine friction findings** — where the orchestrator's behavior felt wrong across multiple ticks
- **What worked** — explicit callout of mandates that produced clean signal. Tuning isn't only about deletion.
- **Changes landed this pass** — bulleted list of every overlay file written and every engine-class report filed, with one-line justification each

This file's existence is the cursor's "reflection ran this cycle" signal — its presence is what unblocks `seal_intent` on the next tick.

### 2. Project-local overlays — when the finding is fixable via the cascade

For every finding where the proposed fix is a mandate revision the project can adopt today, write the overlay directly to disk:

- Hat / review-agent / fix-hat: `.haiku/studios/<studio>/[stages/<stage>/]{hats,review-agents,fix-hats}/<name>.md`
- Discovery / output template: `.haiku/studios/<studio>/{discovery,outputs}/<name>.md`
- Engine prompt: `.haiku/prompts/<rel-path-from-prompts-root>` (mirrors `packages/haiku/src/orchestrator/prompts/...`)

The 2-tier cascade picks the overlay up on the next tick without rebuild. Don't file an FB to "propose" the change — write the overlay. The PR reviewer is the gate.

**Keep overlays surgical.** Copy the canonical mandate, edit the line(s) that need to change, leave the rest. Mid-mandate sweeping rewrites are hard to review and hard to revert.

**Keep overlays project-neutral.** These files live in the project repo so the user benefits immediately, but the *content* must be generally useful — never name a specific person, ticket, or one-off domain quirk. If a finding only applies to this one project, write it into `CLAUDE.md` or a studio-local doc instead, not the overlay tree.

### 3. Engine-class reports — when the cascade can't fix it

For findings that point at engine code, cursor logic, hook behavior, or validator boundaries — anything the project can't fix via overlay — call `haiku_report` with `message` prefixed `[autotune engine-class]` followed by:

- (a) the divergence observed, with the observation file / FB path that backs it
- (b) the engine component (file path, function name) the fix would touch
- (c) the proposed change in concrete terms

The report goes to the H·AI·K·U team via the existing Sentry feedback pipeline. Don't dump project specifics into the message — the engine surface is shared infrastructure; the finding has to read as a general pattern.

## Commit and push

Stage the new `reflection.md`, every overlay you wrote, and any other tracked changes from this pass. Commit with a message that **starts with `autotune:`** — e.g. `autotune: tighten verifier mandate, drop redundant continuity prompt`. The prefix is the audit trail; the PR reviewer reads the commit list to see what the reflection pass changed.

## Discipline

- **Quality over quantity.** Five well-grounded findings beat fifty wild guesses.
- **Ground every finding in artifacts.** Every divergence claim must cite the observation file / FB / mandate path that backs it.
- **Never report engine-class for things the cascade can solve.** If it can land at `.haiku/...`, write the overlay.
- **Single-stage findings get less weight than cross-stage patterns.** If only one stage's observations.md mentions a mandate issue, it's likely stage-specific — overlay the stage-tier file. If multiple stages mention the same pattern, overlay the higher-tier file.

## When you're done

The next `haiku_run_next` tick sees `reflection.md` on disk and falls straight through to `seal_intent`. Any overlays you wrote are picked up by the cascade on the next intent in this project. Any engine-class reports are in front of the H·AI·K·U team.
