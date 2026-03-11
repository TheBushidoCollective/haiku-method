---
name: operate
description: Manage the operation phase - read operational plans, execute agent tasks, guide human tasks, and track operational status
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
  - mcp__haiku__unit_create
  - mcp__haiku__unit_read
  - mcp__haiku__unit_write
  - mcp__haiku__unit_list
  - mcp__haiku__unit_delete
---

## Name

`haiku:operate` - Run the HAIKU operation phase.

## Synopsis

```
/operate [intent-slug]
```

## Description

**User-facing command** - Manage operational tasks for a completed or in-progress intent.

The operate skill reads the operational plan from the intent and:
- Displays the operational plan overview
- Executes `owner: agent` tasks directly (runs commands, scripts) in code mode
- Provides guidance, checklists, and reminders for `owner: human` tasks
- Tracks operational status in session state
- Can trigger a new Elaboration if operational findings suggest changes

## Mode Detection

Detect the operating mode from environment and capabilities:

1. **Code mode**: `CLAUDE_PLUGIN_ROOT` env var is set, Bash tool available. Can execute agent commands directly.
2. **Cowork mode**: MCP tools available, limited local file access. Cannot execute commands; report what would need to be run.
3. **Chat mode**: Only MCP tools available. Cannot execute commands; report what would need to be run.

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
Run /elaborate to start a new task, or provide an intent slug: /operate my-intent
```

### Step 1: Load Operational Plan

Read the operations plan stored as a unit within the intent:

Call `mcp__haiku__unit_read(ws_type, ws_slug, intent_slug, "operations")`.

If the operations unit does not exist:
```
No operational plan found for intent: {intent-slug}

The operational plan is produced during the Execution phase when using
the 'operational' or 'reflective' workflow.

To create one now, use /elaborate to define operational tasks.
```

### Step 2: Parse Operational Plan

The operations content is markdown with frontmatter and task sections:

**Frontmatter fields:**
- `intent` - Intent slug
- `created` - ISO date when plan was created
- `status` - One of: `active`, `paused`, `complete`

**Task sections** (parsed from markdown body):

1. **Recurring Tasks** - Tasks that run on a schedule
   - `name`, `schedule`, `owner` (agent|human), `description`
   - For agent tasks: optional `command` to execute

2. **Reactive Tasks** - Tasks triggered by conditions
   - `name`, `trigger`, `owner` (agent|human)
   - For agent tasks: `command` to execute when triggered
   - For human tasks: `description` of what to do

3. **Manual Tasks** - Tasks performed by humans on a cadence
   - `name`, `frequency`, `owner` (always human)
   - `checklist` - List of steps to complete
   - `description` - What this task accomplishes

### Step 3: Display Operational Overview

Output a summary of the operational plan:

```markdown
## Operational Plan: {Intent Title}

**Intent:** {intent-slug}
**Status:** {status}
**Created:** {created}

### Task Summary

| Type | Count | Agent | Human |
|------|-------|-------|-------|
| Recurring | N | N | N |
| Reactive | N | N | N |
| Manual | N | 0 | N |

### Recurring Tasks
{list each task with schedule and owner}

### Reactive Tasks
{list each task with trigger and owner}

### Manual Tasks
{list each task with frequency and checklist}
```

### Step 4: Handle Agent-Owned Tasks

For tasks where `owner: agent`:

**Code mode**: Execute commands directly via Bash tool:
1. **Recurring tasks with a command**: Execute the command and report results
2. **Reactive tasks with a command**: Check if the trigger condition is met, then execute
3. Report execution results including exit code and output

**Chat/Cowork mode**: Cannot execute commands. Instead:
1. List each agent task with its command
2. Report what commands would need to be run
3. Provide the commands as copyable text for the user to execute manually

### Step 5: Handle Human-Owned Tasks

For tasks where `owner: human`:

1. Display the task description and any checklist items
2. Show the schedule or frequency
3. Provide actionable guidance

```markdown
### Human Task: {name}

**Schedule:** {schedule/frequency}
**Description:** {description}

#### Checklist
- [ ] {step 1}
- [ ] {step 2}
- [ ] {step 3}
```

### Step 6: Track Operational Status

Update operation status in session state via MCP:

1. Call `mcp__haiku__state_read("operation-status")` to load existing status.
2. If empty, initialize: `{"phase":"operation","operationStatus":"active","operationalTasks":{}}`
3. After executing tasks, update the status:
   ```json
   {
     "phase": "operation",
     "operationStatus": "active",
     "operationalTasks": {
       "task-name": {
         "lastRun": "2026-03-06T12:00:00Z",
         "status": "on-track"
       }
     }
   }
   ```
4. Call `mcp__haiku__state_write("operation-status", updated_json_string)`.

### Step 7: Trigger Re-Elaboration (If Needed)

If operational findings suggest the intent needs changes:

```markdown
### Operational Finding

{description of the issue}

**Recommendation:** Re-elaborate this intent to address operational concerns.

Run `/elaborate` to start a new elaboration cycle.
```

### Step 8: Output Summary

```markdown
## Operation Status

**Intent:** {intent-slug}
**Overall Status:** {operationStatus}

### Task Results

| Task | Type | Owner | Last Run | Status |
|------|------|-------|----------|--------|
| {name} | recurring | agent | {time} | on-track |
| {name} | manual | human | - | pending |

### Next Actions
{list of upcoming or overdue tasks}
```
