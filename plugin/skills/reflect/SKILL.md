---
name: reflect
description: Analyze a completed HAIKU intent cycle and produce reflection artifacts with learnings, metrics, and recommendations
argument-hint: "[intent-slug]"
allowed-tools:
  # HAIKU MCP tools
  - mcp__haiku__workspace_info
  - mcp__haiku__settings_read
  - mcp__haiku__settings_write
  - mcp__haiku__memory_read
  - mcp__haiku__memory_write
  - mcp__haiku__memory_list
  - mcp__haiku__memory_context
  - mcp__haiku__memory_delete
  - mcp__haiku__state_read
  - mcp__haiku__state_write
  - mcp__haiku__state_list
  - mcp__haiku__state_delete
  - mcp__haiku__intent_create
  - mcp__haiku__intent_read
  - mcp__haiku__intent_write
  - mcp__haiku__intent_list
  - mcp__haiku__intent_delete
  - mcp__haiku__unit_create
  - mcp__haiku__unit_read
  - mcp__haiku__unit_write
  - mcp__haiku__unit_list
  - mcp__haiku__unit_delete
---

## Name

`haiku:reflect` - Reflection phase for analyzing outcomes and capturing learnings.

## Synopsis

```
/reflect [intent-slug]
```

## Description

**User-facing command** - Analyze a completed (or nearly completed) HAIKU execution cycle.

The reflect skill:
1. Reads all unit specs, execution state, and operational outcomes for the intent
2. Analyzes the full cycle: execution metrics, what worked, what didn't, patterns
3. Produces a `reflection` artifact in the intent
4. Presents findings for user validation and augmentation
5. Offers two paths: **Iterate** (create intent v2 with learnings) or **Close** (capture organizational memory and archive)

## Mode Detection

Detect the operating mode from environment and capabilities:

1. **Code mode**: `CLAUDE_PLUGIN_ROOT` env var is set, Bash tool available. Can use `dag.sh`, git operations.
2. **Cowork mode**: MCP tools available, limited local file access.
3. **Chat mode**: Only MCP tools available.

The practical detection: If you can call `Bash`, you're in code mode. Otherwise cowork/chat.

## Workspace Coordinates

Before any MCP calls, read the workspace coordinates from session state:

1. Call `mcp__haiku__state_read("workspace_type")` -> ws_type (default: "user")
2. Call `mcp__haiku__state_read("workspace_slug")` -> ws_slug
3. Use ws_type and ws_slug for all subsequent MCP calls.

## Implementation

### Step 0: Load State

Read the intent slug from state or argument:

1. If an argument was provided, use it as INTENT_SLUG.
2. Otherwise, call `mcp__haiku__state_read("intent-slug")` -> INTENT_SLUG.

If no intent slug found:
```
No HAIKU intent found.
Run /elaborate to start a new task, or provide an intent slug: /reflect my-intent
```

### Step 1: Load Intent and Unit Data

Read all artifacts via MCP:

1. Call `mcp__haiku__intent_read(ws_type, ws_slug, intent_slug)` for the intent definition, success criteria, and scope.
2. Call `mcp__haiku__unit_list(ws_type, ws_slug, intent_slug)` to get all unit names.
3. For each unit, call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, unit_name)` to get content with status.
4. Call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, "operations")` for the operational plan (if exists).
5. Call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, "completion-criteria")` for consolidated criteria (if exists).

If intent does not exist:
```
No intent found: {intent-slug}

Run /elaborate to create a new intent.
```

### Step 2: Gather Execution Metrics

Collect data from session state via MCP:

1. Call `mcp__haiku__state_read("iteration")` for iteration state.
2. Call `mcp__haiku__state_read("operation-status")` for operational task status.

3. **Build DAG summary**:
   - **Code mode**: Use `dag.sh` via Bash — `get_dag_summary "$INTENT_DIR"`.
   - **Chat/Cowork mode**: From the unit data already loaded in Step 1, count units by status (completed, pending, in_progress, blocked). For each pending unit, check if all `depends_on` units are completed to determine ready vs blocked.

Metrics to extract:
- **Units completed** vs total
- **Total iterations** (from iteration state)
- **Workflow used** (from iteration state)
- **Blockers encountered** (from unit scratchpads and state)
- **Quality gate pass/fail history** (from state if recorded)
- **Operational task status** (from operation-status state)

### Step 2b: Load Session Transcript (if available)

**Code mode only**: Check if the session transcript is accessible via `HAIKU_TRANSCRIPT_PATH` environment variable.

If the transcript is available, read it to extract conversation-level insights that artifacts alone cannot capture. Look for:
- **Decision points** — where the user made choices or changed direction
- **Confusion or rework** — repeated attempts, corrections, or misunderstandings
- **Implicit feedback** — user satisfaction signals, frustration, or surprise
- **Collaboration dynamics** — how initiative was shared between human and AI
- **Tool usage patterns** — which tools were effective, which caused friction
- **Context loss** — moments where the AI lost track or needed reminding

**This step is optional.** If `HAIKU_TRANSCRIPT_PATH` is not set or the file doesn't exist, skip transcript analysis and rely solely on artifacts and state. Note in the reflection that transcript analysis was not available.

### Step 3: Don the Reflector Hat

Load and follow the Reflector hat instructions from `hats/reflector.md`.

As the Reflector, analyze:

1. **Execution patterns** — Which units went smoothly? Which required retries?
2. **Criteria satisfaction** — How well were success criteria met? Any partial satisfaction?
3. **Process observations** — What approaches worked? What was painful?
4. **Operational outcomes** — How did operational tasks perform? Any gaps?
5. **Blocker analysis** — Were blockers systemic or one-off? Could they be prevented?

If the session transcript was loaded in Step 2b, also analyze:

6. **Collaboration quality** — How well did human and AI work together? Were handoffs smooth?
7. **Decision archaeology** — What decisions were made during the session? Were any revisited or reversed?
8. **Process friction** — Where did the workflow create friction? Where was it smooth?
9. **Implicit learnings** — What did the conversation reveal that the artifacts don't capture?

Ground all analysis in evidence from the artifacts and transcript. Do not speculate without data.

### Step 4: Produce reflection artifact

Write the reflection as a unit within the intent:

Call `mcp__haiku__unit_create(ws_type, ws_slug, intent_slug, "reflection", content)` with:

```markdown
---
intent: {intent-slug}
version: 1
created: {ISO date}
status: complete
---

# Reflection: {Intent Title}

## Execution Summary
- Units completed: N/M
- Total iterations: X
- Workflow: {workflow name}
- Blockers encountered: Z

## What Worked
- {Specific thing with evidence from execution}

## What Didn't Work
- {Specific thing with proposed improvement}

## Operational Outcomes
- {How operational tasks performed, if applicable}

## Collaboration Insights
{Only include this section if transcript analysis was available}
- **Decision points**: {Key decisions and their outcomes}
- **Process friction**: {Where the workflow helped or hindered}
- **Collaboration dynamics**: {How human-AI interaction evolved}

## Key Learnings
- {Distilled actionable insight}

## Recommendations
- [ ] {Specific recommendation}

## Next Iteration Seed
{What v2 should focus on, if the user chooses to iterate}
```

### Step 5: Present Findings for Validation

Output the reflection summary and ask the user to:
1. Validate the findings -- are they accurate?
2. Add human observations the agent may have missed
3. Correct any mischaracterizations

Use `AskUserQuestion` to gather user input.

Update the reflection via `mcp__haiku__unit_write(ws_type, ws_slug, intent_slug, "reflection", updated_content)` with any user corrections or additions.

### Step 6: Update State

Update reflection status in session state:

```
mcp__haiku__state_write("reflection-status", '{"phase":"reflection","reflectionStatus":"awaiting-input","version":1,"previousVersions":[]}')
```

After user validates:
```
mcp__haiku__state_write("reflection-status", '{"phase":"reflection","reflectionStatus":"complete","version":1,"previousVersions":[]}')
```

### Step 7: Offer Next Steps

Present two paths:

```markdown
## Next Steps

The reflection is complete. Choose a path:

### Option A: Iterate
Create a new version of this intent with learnings pre-loaded.
- Archives current intent as v1
- Creates new elaboration with reflection context
- Pre-loads recommendations as constraints

### Option B: Close
Capture organizational learnings and archive this intent.
- Distills key learnings into organizational memory
- Syncs to MCP server if `memory.mcp` is configured
- Archives the intent
```

Use `AskUserQuestion` to get the user's choice.

### Step 7a: Iterate Path

If user chooses to iterate:

1. **Determine version number**: Parse from reflection-status state.

2. **Archive current intent** (code mode only):
   - Git tag: `git tag "haiku/${INTENT_SLUG}/v${CURRENT_VERSION}" 2>/dev/null || true`

3. **Update intent status**: Read intent via `mcp__haiku__intent_read`, change `status: active` to `status: archived` in frontmatter, write back via `mcp__haiku__intent_write`.

4. **Seed new intent**: Call `mcp__haiku__intent_create(ws_type, ws_slug, intent_slug + "-v" + next_version, new_content)` with a new intent that references the reflection learnings and pre-loads recommendations as constraints.

5. **Update state**:
   ```
   mcp__haiku__state_write("intent-slug", new_intent_slug)
   mcp__haiku__state_write("reflection-status", updated_json)
   ```

6. **Output**:
   ```markdown
   ## Intent Archived and Ready for v{NEXT_VERSION}

   **Archived:** {intent-slug} (status: archived)
   **New intent:** {new-intent-slug}

   The new intent has been seeded with learnings from the reflection.
   Run `/elaborate` to begin the next iteration with pre-loaded context.
   ```

### Step 7b: Close Path

If user chooses to close:

1. **Distill learnings** into concise, reusable patterns.

2. **Write organizational memory** via MCP:

   Call `mcp__haiku__memory_write(ws_type, ws_slug, "learnings", content, "append")` with:

   ```markdown
   ## {Intent Title} ({ISO date})

   ### Patterns
   - {Reusable pattern from this intent}

   ### Anti-Patterns
   - {What to avoid, with context}

   ### Process Insights
   - {Process improvement that applies broadly}
   ```

   If the workspace settings (via `mcp__haiku__settings_read`) has `memory.mcp` configured, also write the learnings to that MCP server so they are accessible to the broader team.

3. **Archive intent**: Read intent via `mcp__haiku__intent_read`, change `status: active` to `status: archived` in frontmatter, write back via `mcp__haiku__intent_write`.

4. **Output**:
   ```markdown
   ## Intent Closed

   **Intent:** {title}
   **Status:** archived
   **Learnings saved to:** workspace memory (learnings)

   ### Key Learnings Captured
   {summary of what was written to memory}

   The intent has been archived. Learnings are available for future intents.
   ```
