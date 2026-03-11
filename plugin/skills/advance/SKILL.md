---
name: advance
description: (Internal) Advance to the next hat in the HAIKU workflow
user-invocable: false
allowed-tools:
  # HAIKU MCP tools
  - mcp__haiku__workspace_info
  - mcp__haiku__settings_read
  - mcp__haiku__memory_read
  - mcp__haiku__memory_context
  - mcp__haiku__state_read
  - mcp__haiku__state_write
  - mcp__haiku__state_list
  - mcp__haiku__intent_read
  - mcp__haiku__intent_write
  - mcp__haiku__intent_list
  - mcp__haiku__unit_create
  - mcp__haiku__unit_read
  - mcp__haiku__unit_write
  - mcp__haiku__unit_list
---

## Name

`haiku:advance` - Move to the next hat in the HAIKU workflow sequence.

## Synopsis

```
/advance
```

## Description

**Internal command** - Called by the AI during `/execute`, not directly by users.

Advances to the next hat in the workflow sequence. For example, in the default workflow:
- planner -> executor (plan ready, now execute)
- executor -> reviewer (execution complete, now review)

**When at the last hat (reviewer)**, `/advance` handles completion automatically:
- If all units complete -> Mark intent as complete
- If more units ready -> Loop back to executor for next unit
- If blocked (no ready units) -> Alert user

## Mode Detection

Detect the operating mode from environment and capabilities:

1. **Code mode**: `CLAUDE_PLUGIN_ROOT` env var is set, Bash tool available. Can use `dag.sh` for local DAG operations.
2. **Cowork mode**: MCP tools available, limited local file access.
3. **Chat mode**: Only MCP tools available.

The practical detection: If you can call `Bash`, you're in code mode. Otherwise cowork/chat.

## Implementation

### Step 1: Load Current State

Read workspace coordinates and session state from MCP:

1. Call `mcp__haiku__state_read("workspace_type")` -> ws_type (default: "user")
2. Call `mcp__haiku__state_read("workspace_slug")` -> ws_slug
3. Call `mcp__haiku__state_read("iteration")` -> STATE (JSON string)
4. Call `mcp__haiku__state_read("intent-slug")` -> INTENT_SLUG

Parse STATE to get `hat`, `workflow` array, `iteration` count, `currentUnit`, etc.

### Step 2: Determine Next Hat

```javascript
const workflow = state.workflow || ["planner", "executor", "reviewer"];
const currentIndex = workflow.indexOf(state.hat);
const nextIndex = currentIndex + 1;

if (nextIndex >= workflow.length) {
  // At last hat - check DAG status
  // See Step 2b below
}

const nextHat = workflow[nextIndex];
```

### Step 2b: Last Hat Logic

When at the last hat, mark the current unit complete and check DAG status:

1. Get the current unit from STATE (`currentUnit` field).
2. **Mark unit completed** via MCP:
   - Call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, current_unit)` to get content.
   - Replace `status: in_progress` with `status: completed` in frontmatter.
   - Call `mcp__haiku__unit_write(ws_type, ws_slug, intent_slug, current_unit, updated_content)`.

3. **Check DAG status**:
   - **Code mode**: Use `dag.sh` via Bash — `get_dag_summary "$INTENT_DIR"`.
   - **Chat/Cowork mode**: Call `mcp__haiku__unit_list(ws_type, ws_slug, intent_slug)`, then `mcp__haiku__unit_read` for each unit. Parse frontmatter to count completed, pending, in_progress, and blocked units.

4. **Decision logic**:
   - **All complete (no passes or last pass)**: Mark intent complete, output summary.
   - **Pass complete (more passes remain)**: Transition to next pass — see Step 2c.
   - **More units ready**: Loop back to first hat for next unit.
   - **All blocked**: Alert user.

### Step 2c: Pass Transition Logic

When all units for the current pass are complete but the intent has more passes:

1. Read intent via `mcp__haiku__intent_read(ws_type, ws_slug, intent_slug)`.
2. Parse `passes` array and `active_pass` from frontmatter.
3. Determine the next pass (the pass after `active_pass` in the `passes` array).
4. If a next pass exists:
   - Read the full intent content, replace `active_pass: {current}` with `active_pass: {next}` in frontmatter.
   - Write back via `mcp__haiku__intent_write(ws_type, ws_slug, intent_slug, updated_content)`.
   - Notify the user: "The **{active_pass}** pass is complete. The next pass is **{next_pass}**. Run `/elaborate` to define {next_pass} units using the artifacts from the {active_pass} pass."
   - Stop execution — the user will re-elaborate for the next pass.
5. If no next pass (last pass or no passes configured): Continue with normal completion logic.

### Step 3: Update State

Increment iteration and update the hat in session state:

```
mcp__haiku__state_write("iteration", '{"iteration": N+1, "hat": "nextHat", ...}')
```

### Step 4: Confirm

Output:
```
Advanced to **{nextHat}** hat. Continuing execution...
```

### Step 5: Completion Summary

When all units done:

```
## Intent Complete!

**Total iterations:** {count}
**Workflow:** {name}

### What Was Done
{Summary from intent}

### Units Completed
{List of completed units}

### Criteria Satisfied
{List of completion criteria}
```
