---
name: resume
description: Resume work on an existing HAIKU intent when state is lost
argument-hint: "[intent-slug]"
allowed-tools:
  # HAIKU MCP tools
  - mcp__haiku__workspace_info
  - mcp__haiku__settings_read
  - mcp__haiku__memory_read
  - mcp__haiku__memory_context
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
---

## Name

`haiku:resume` - Resume an existing HAIKU intent.

## Synopsis

```
/resume [intent-slug]
```

## Description

**User-facing command** - Resume work on an intent when iteration state is lost but workspace artifacts exist.

This happens when:
- Session context was cleared unexpectedly
- Starting fresh session after previous work
- State lost but artifacts preserved

## Mode Detection

Detect the operating mode from environment and capabilities:

1. **Code mode**: `CLAUDE_PLUGIN_ROOT` env var is set, Bash tool available. Can use `dag.sh` for local DAG operations.
2. **Cowork mode**: MCP tools available, limited local file access.
3. **Chat mode**: Only MCP tools available.

The practical detection: If you can call `Bash`, you're in code mode. Otherwise cowork/chat.

## Workspace Coordinates

Before any MCP calls, read the workspace coordinates from session state (they may already be set from a previous session):

1. Call `mcp__haiku__state_read("workspace_type")` -> ws_type (default: "user")
2. Call `mcp__haiku__state_read("workspace_slug")` -> ws_slug
3. If not found, call `mcp__haiku__workspace_info(workspace_type: "user")` to discover/provision the workspace.
4. Store coordinates: `mcp__haiku__state_write("workspace_type", ws_type)` and `mcp__haiku__state_write("workspace_slug", ws_slug)`.

## Implementation

### Step 1: Find Resumable Intents

If no slug provided as argument, scan for active intents:

1. Call `mcp__haiku__intent_list(ws_type, ws_slug)` to get all intent slugs.
2. For each intent, call `mcp__haiku__intent_read(ws_type, ws_slug, intent_slug)` and parse the `status` field from frontmatter.
3. Filter for intents with `status: active`.

**Selection logic:**
- 1 intent found -> auto-select
- Multiple intents -> list and prompt user
- 0 intents -> error, suggest `/elaborate`

If a slug was provided as argument, use it directly.

### Step 2: Load Intent Metadata

Read the intent to extract metadata:

1. Call `mcp__haiku__intent_read(ws_type, ws_slug, intent_slug)`.
2. Parse frontmatter to extract:
   - `workflow` (default: "default")
   - `title` (default: the slug)
   - `passes` and `active_pass` (if multi-pass)

### Step 3: Determine Starting Hat

Analyze unit statuses to determine where to resume:

**Code mode** — Use `dag.sh` via Bash:
```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"
starting_hat=$(get_recommended_hat "$INTENT_DIR" "${WORKFLOW}")
```

**Chat/Cowork mode** — Use MCP tools:

1. Call `mcp__haiku__unit_list(ws_type, ws_slug, intent_slug)` to get all units.
2. For each unit, call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, unit_name)` and parse `status` from frontmatter.
3. Count units by status: completed, in_progress, pending, blocked.
4. For pending units, check `depends_on` to determine if they're ready or blocked.
5. Apply hat selection logic:
   - **No units exist** -> `planner` (2nd hat if workflow has 3+ hats, else 1st)
   - **All units completed** -> last hat (reviewer)
   - **Any units in_progress or ready** -> `executor` (3rd hat if workflow has 3+ hats)
   - **All units blocked** -> `planner`

### Step 4: Initialize State

Store session state via MCP:

1. Resolve the workflow hats array. In code mode, read from `workflows.yml`. In chat/cowork mode, use standard mappings:
   - `default`: `["planner", "executor", "reviewer"]`
   - `operational`: `["planner", "executor", "operator", "reviewer"]`
   - `reflective`: `["planner", "executor", "operator", "reflector", "reviewer"]`

2. Write state:
   ```
   mcp__haiku__state_write("intent-slug", slug)
   mcp__haiku__state_write("workspace_type", ws_type)
   mcp__haiku__state_write("workspace_slug", ws_slug)
   mcp__haiku__state_write("iteration", '{"iteration":1,"hat":"starting_hat","workflowName":"workflow","workflow":["hat1","hat2","hat3"],"status":"active"}')
   ```

### Step 5: Output Confirmation

Build a DAG status table:

**Code mode**: Use `get_dag_status_table` from dag.sh.

**Chat/Cowork mode**: From the unit data already loaded, build a table showing each unit's name, status, and blocking dependencies.

```markdown
## HAIKU Intent Resumed

**Intent:** {title}
**Slug:** {slug}
**Workspace:** {ws_type}/{ws_slug}
**Workflow:** {workflow}
**Starting Hat:** {startingHat}

### Unit Status
| Unit | Status | Blocked By |
|------|--------|------------|
| unit-01-setup | completed | |
| unit-02-api | in_progress | |
| unit-03-ui | pending | unit-02-api |

**Summary:** {completed}/{total} units completed

**Next:** Run `/execute` to continue the execution loop.
```
