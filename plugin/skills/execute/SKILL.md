---
name: execute
description: Continue the HAIKU execution loop - autonomous execute/review cycles until completion
argument-hint: "[intent-slug] [unit-name]"
disable-model-invocation: true
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
  - mcp__haiku__unit_create
  - mcp__haiku__unit_read
  - mcp__haiku__unit_write
  - mcp__haiku__unit_list
  - mcp__haiku__unit_delete
---

## Name

`haiku:execute` - Run the autonomous HAIKU execution loop.

## Synopsis

```
/execute [intent-slug] [unit-name]
```

## Description

**User-facing command** - Continue the HAIKU autonomous execution loop.

**Two modes:**
- `/execute` -- DAG-driven, picks next ready unit
- `/execute unit-01-setup` -- target a specific unit

This command resumes work from the current hat and runs until:
- All units complete
- User intervention needed (all units blocked)
- Session exhausted (Stop hook instructs agent to call `/execute`)

**CRITICAL: No Questions During Execution**

During the execution loop, you MUST NOT:
- Use AskUserQuestion tool
- Ask clarifying questions
- Request user decisions

If you encounter ambiguity:
1. Make a reasonable decision based on available context
2. Document the assumption in your work
3. Let the reviewer hat catch issues on the next pass

## Mode Detection

Detect the operating mode from environment and capabilities:

1. **Code mode** (full Claude Code session):
   - `CLAUDE_PLUGIN_ROOT` env var is set
   - Has access to Bash, Read, Write, Edit, Glob, Grep tools
   - Full quality gates, git operations, local DAG via `dag.sh`

2. **Cowork mode** (Claude Code with limited tools):
   - MCP tools available (`mcp__haiku__*`)
   - Limited local file access
   - Skip git operations, limited quality gates

3. **Chat mode** (no local tools):
   - Only MCP tools available
   - No Bash, Read, Write, etc.
   - Skip quality gates, all data via MCP

The practical detection: If you can call `Bash`, you're in code mode. If you have MCP but no Bash, you're in cowork mode. If only MCP, chat mode.

## Implementation

### Step 0: Load State

Read workspace coordinates and session state from MCP:

1. Call `mcp__haiku__state_read("workspace_type")` -> ws_type (default: "user")
2. Call `mcp__haiku__state_read("workspace_slug")` -> ws_slug
3. Call `mcp__haiku__state_read("iteration")` -> STATE (JSON string)
4. Call `mcp__haiku__state_read("intent-slug")` -> INTENT_SLUG

If no state found (state_read returns empty or "not found"):
```
No HAIKU state found.
Run /elaborate to start a new task, or /resume to continue an existing one.
```

Parse the iteration JSON. If `status` is "complete":
```
Task already complete! Run /elaborate to start a new task.
```

### Step 1: Find Next Unit

**Code mode** — Use `dag.sh` via Bash for local DAG operations:
```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"
INTENT_DIR="$WORKSPACE/intents/${INTENT_SLUG}"
ACTIVE_PASS=$(_yaml_get_simple "active_pass" "" < "$INTENT_DIR/intent.md")
if [ -n "$ACTIVE_PASS" ]; then
  READY=$(find_ready_units_for_pass "$INTENT_DIR" "$ACTIVE_PASS")
else
  READY=$(find_ready_units "$INTENT_DIR")
fi
```

**Chat/Cowork mode** — Use MCP tools to find the next ready unit:

1. Read the intent to get `active_pass`: Call `mcp__haiku__intent_read(ws_type, ws_slug, intent_slug)`, parse the `active_pass` field from frontmatter.
2. List all units: Call `mcp__haiku__unit_list(ws_type, ws_slug, intent_slug)`.
3. For each unit, call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, unit_name)` to get its content.
4. Parse frontmatter from each unit to extract `status`, `depends_on`, and `pass`.
5. Apply DAG logic: A unit is **ready** if:
   - `status` is `pending`
   - All units listed in `depends_on` have `status: completed`
   - If `active_pass` is set, the unit's `pass` field matches `active_pass`
6. Pick the first ready unit (lowest number).

If targeting a specific unit (argument provided), validate it exists and check its dependencies.

If no ready units and no in-progress units:
- If all units are completed, the intent is done.
- Otherwise, all remaining units are blocked — alert the user.

### Step 2: Mark Unit In Progress

**Code mode**: Use `update_unit_status` from dag.sh.

**Chat/Cowork mode**: Update the unit status via MCP:
1. Call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, unit_name)` to get full content.
2. In the returned markdown, find `status: pending` in the frontmatter and replace with `status: in_progress`.
3. Call `mcp__haiku__unit_write(ws_type, ws_slug, intent_slug, unit_name, updated_content)` with the modified content.

### Step 3: Execute Hat Workflow

Based on the `hat` field in the iteration state, spawn the appropriate subagent:

| Role | Description |
|------|-------------|
| `planner` | Creates tactical execution plan |
| `executor` | Executes the plan |
| `operator` | Validates operational readiness |
| `reflector` | Analyzes outcomes and captures learnings |
| `reviewer` | Verifies completion criteria |

Load hat instructions from the workspace or plugin hats directory and include in the subagent prompt.

### Step 4: Run Quality Gates

**Code mode only** — Before advancing, check quality gates:

1. Read settings via `mcp__haiku__settings_read(ws_type, ws_slug)`.
2. Extract the `gates` configuration from settings (JSON array).
3. Source `${CLAUDE_PLUGIN_ROOT}/lib/config.sh` and call `run_gates "Stop" "$gates_json"`.

**Chat/Cowork mode**: Skip command-type gates (cannot execute commands). If settings contain manual-type gates, report them as checklist items for the user.

### Step 5: Handle Result

- **Success/Complete**: Call `/advance` to move to next hat
- **Issues found** (reviewer): Return to executor
- **Blocked**: Document and stop for user intervention

### Step 6: Loop or Complete

The execution loop continues until:
1. **Complete** - All units done
2. **All blocked** - No forward progress possible
3. **Session exhausted** - Stop hook fires

When all units complete, output:

```
## Intent Complete!

**Total iterations:** {count}
**Workflow:** {name}

### Units Completed
{list}

### Criteria Satisfied
{list}
```
