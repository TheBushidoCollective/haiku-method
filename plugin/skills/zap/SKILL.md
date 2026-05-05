---
name: zap
description: Zero-ceremony single-unit execution — run one task directly through a stage's hat loop without intent or workflow scaffolding
---

# Zap

Run a single task directly through a stage's hat loop. No intent file, no unit decomposition, no workflow tick — just the studio's hat sequence applied inline to the work.

**Use for:** bug fixes, typos, config tweaks, small refactors — any task where the cost of a mistake is "edit and re-run," not "rollback a pipeline."

**Not for:** tasks that span multiple stages, need architecture decisions, or involve multiple sub-systems. Use `/haiku:quick` or `/haiku:start` for those.

## Arguments

- `studio` — Studio slug (e.g. `software`, `marketing`, `documentation`). Optional — defaults to `software` if the project has a git repo and no other context narrows it.
- `stage` — Stage within the studio (e.g. `development`, `inception`, `design`). Optional — defaults to the most execution-oriented stage in the studio (e.g. `development` for `software`).

## Process

### 0. Preflight — clean working tree

Run `git status --porcelain`. If the working tree has uncommitted changes (staged or unstaged), stop and ask the user via `AskUserQuestion`:
- options: `["Commit/stash my changes first, then re-run zap", "Proceed anyway (zap may sweep my unrelated changes into its commit)"]`

If the user picks the first option: acknowledge and stop. Don't try to commit/stash for them.
If the user picks the second option: continue, but record the pre-existing dirty paths so the builder can be told to leave them alone.

If the tree is clean, continue.

### 1. Resolve studio and stage

**If studio is provided:**
1. Call `haiku_studio_list` to get the available studios.
2. If the provided studio is not in the list, surface the issue with `AskUserQuestion` and let the user pick from the real list.
3. Then call `haiku_studio_stage_get { studio, stage }` to validate the stage. If `found: false`, the stage (not the studio) is the problem — surface the studio's actual `stages:` list and let the user pick.

**If studio is NOT provided:**
1. Call `haiku_studio_list`.
2. Check project context (language files, existing `.haiku/settings.yml`) to infer the best fit.
3. Default to `software` if it exists and no other signal is stronger.

**If stage is NOT provided:** use the studio's primary execution stage. For `software` this is `development`. For others, pick the build-class stage from the studio's `stages:` list (the one that produces code/artifacts, not research or design).

### 2. Load stage context

Call `haiku_studio_stage_get { studio: "<studio>", stage: "<stage>" }`.

The response contains:
- `hats` — ordered list of hat names (e.g. `["planner", "builder", "reviewer"]`)
- `stage_md` — absolute path to the STAGE.md file
- `body` — the stage's prose description

Derive the hats directory path: `dirname(stage_md) + "/hats/"`. Each hat file lives at `<hats_dir>/<hat>.md`.

Read every hat file in the `hats:` list with the Read tool before dispatching.

### 3. Clarify the task (brief prelaboration)

If the user's task description is vague (no clear action, no clear target, or under one sentence), ask ONE focused question via `AskUserQuestion` with pre-populated `options[]`. Otherwise skip.

**Do NOT** run a full elaboration phase — one question at most.

### 4. Run the hat loop

Execute each hat in the `hats:` list as a **sequential** subagent. Each hat receives the prior hat's output. Do NOT parallelize.

For each hat, spawn a subagent (Task tool) with the prompt below. Wait for it to return before spawning the next one.

The hat's role is determined by its position in the list:
- **First hat** → planner role
- **Last hat** → verifier role (must return PASS/FAIL)
- **Any middle hats** → builder/doer role

Hat names that contain `verif`, `review`, `check`, or `assess` always get verifier role regardless of position. Hat names that contain `plan` or `design` always get planner role regardless of position. The hat's own mandate file (`hats/<hat>.md`) is the primary source of behavioral instruction; the per-hat instructions below are zap-specific framing on top of that mandate.

---

#### Hat subagent prompt

```
You are executing a zap task as the **<HAT>** hat in stage **<STAGE>** of studio **<STUDIO>**.

This is a zap run — no workflow engine, no unit files, no haiku_* tool calls. Work directly on the repo.

## Stage scope

<STAGE.md body — paste verbatim>

## Your mandate: <HAT>

<hat.md body — paste verbatim>

Note: this mandate was written for the workflow-engine context. Where it references units, feedback files, or haiku_* tools, translate that as: work directly on the repo, return your output as plain text to the parent. Do NOT call any haiku_* tools.

## Task

<user's task description>

<if retry: prepend a "## Prior failure context" block here with the verifier's FAIL reason>

<if not the first hat:>
## Input from prior hat (<PRIOR_HAT>)

<prior hat's returned output — paste verbatim>

<if user opted to proceed with a dirty tree:>
## Pre-existing uncommitted changes (do NOT modify)

<list of files from git status --porcelain at preflight>

## Instructions

<role-specific instructions — see below>
```

---

#### Per-role instructions

**Planner role (first hat, or any hat with `plan`/`design` in the name):**
```
1. Read the task and stage scope above.
2. Produce a concise implementation plan:
   - Files to inspect or modify (with reasoning)
   - Step-by-step approach (3–5 items)
   - Risks or edge cases to watch for
3. Return your plan as plain text. Do NOT implement — planning only.
```

**Builder/doer role (middle hats, default for hats not matching planner or verifier name patterns):**
```
1. Read the prior hat's output above and the hat mandate.
2. Apply your hat's role to the task. If your mandate is "build/implement," write the code. If your mandate is "critique/refine prior output," critique it and emit a revised plan or revised work as appropriate.
3. If you wrote or modified files, run any project quality gates (tests, lint, typecheck) and fix failures.
4. Do NOT commit. Leave changes uncommitted in the working tree — the parent skill commits once at the end after the verifier passes.
5. Return a summary:
   - Files you created/modified (exact paths)
   - Quality gate results (commands run, pass/fail)
   - One-paragraph description of what changed and why
```

**Verifier role (last hat, or any hat with `verif`/`review`/`check`/`assess` in the name):**
```
1. Read the task description and the prior hat outputs (especially the builder's summary).
2. Inspect the actual uncommitted changes with `git status --porcelain` and `git diff` to confirm they match the summary.
3. Verify the work meets the task's success criteria:
   - Does the change address exactly what was asked?
   - Is the code internally consistent and free of obvious regressions?
   - Are there edge cases the builder missed that the stage scope would flag?
4. Your final message MUST be structured exactly as one of these two formats:

   On success (single line, then a Files block):
   ```
   PASS — <one-sentence summary of what was verified>
   Files:
   <path1>
   <path2>
   ...
   ```

   On failure (single line, no files block):
   ```
   FAIL — <specific reason the task is not complete or correct>
   ```

   The Files block on PASS lists the exact paths the parent should stage. Include only paths you confirmed via `git diff` are part of the task's intended change. Exclude any pre-existing dirty paths that were called out in the prompt.

5. Do NOT run quality gates — that was the builder's job. Focus on correctness and fit.
6. Do NOT commit, amend, or otherwise mutate the git tree.
7. Do NOT call any haiku_* tools.
```

---

### 5. Handle the verifier verdict

Parse the verifier's first line for the `PASS` or `FAIL` token (anchored to the start of the first line, followed by ` — `). Initialize a retry counter at 0 before the first hat-loop run.

**If `PASS`:**
1. Read the `Files:` block from the verifier's output. Stage exactly those paths: `git add <path1> <path2> ...`. Do NOT use `git add -A` or `git add .` — that would sweep in any pre-existing dirty paths the user opted into.
2. Commit with a brief message derived from the task description and verifier summary: `git commit -m "<message>"`.
3. Report success to the user: files committed, commands run, verifier's PASS line.

**If `FAIL`:**
1. Surface the failure reason to the user.
2. If the retry counter is **less than 2**, ask via `AskUserQuestion`:
   - options: `["Retry the hat loop with this failure as context", "Abandon — I'll fix it manually"]`
3. If the retry counter is **2 or more**, do NOT offer retry. Tell the user: "Two retries already used — zap isn't converging. Discard the uncommitted changes (`git restore .`) and either fix manually or use `/haiku:start` for a structured run." Stop.

If the user picks retry:
- Increment the retry counter.
- Do NOT touch the working tree — the builder's prior uncommitted changes carry forward as the new starting state.
- Re-run from step 4, prepending `## Prior failure context: <verifier's FAIL reason>` to the task description.

If the user picks abandon: acknowledge, leave the uncommitted changes in place (the user said they'd fix manually), and stop.

**If a hat subagent errors out** (returns no output, throws, or crashes): treat it as a `FAIL` with reason `"<HAT> subagent errored: <error message>"` and route through the failure path above. Do not silently retry.

## Guardrails

- **Scope check:** if the task description spans multiple stages (e.g. "redesign the auth flow AND implement the backend AND write the tests"), recommend `/haiku:quick` or `/haiku:start` and explain why. Don't blindly zap a multi-stage task through a single stage's hat loop.
- **Stage validation:** if `haiku_studio_stage_get` returns `found: false` after a valid studio, the stage is the problem — surface the studio's `stages:` list, not a generic "studio/stage not found."
- **Stateless:** no `.haiku/` files are written. If the user needs formal traceability, suggest `/haiku:quick`.
- **Hat count:** most stages have 3 hats. If a stage has more (adversarial loops, etc.), run all of them in sequence — the hat order in `hats:` is the authority. Role assignment uses the name-pattern rules in step 4.
- **Retry cap:** at most 2 retries (3 total attempts). Past that, the skill stops and tells the user to bail out to `/haiku:start` or fix manually.
- **Commit safety:** only the parent skill commits, only after verifier PASS, only the exact files the builder reported. The builder, planner, and verifier never commit.
