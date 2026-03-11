---
name: elaborate
description: Start HAIKU elaboration to collaboratively define intent, success criteria, and decompose into units. Use when starting a new task or project.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
  - Skill
  - WebSearch
  - WebFetch
  - AskUserQuestion
  - ToolSearch
  - ListMcpResourcesTool
  - ReadMcpResourceTool
  - "mcp__*__read*"
  - "mcp__*__get*"
  - "mcp__*__list*"
  - "mcp__*__search*"
  - "mcp__*__query*"
  - "mcp__*__ask*"
  - "mcp__*__resolve*"
  - "mcp__*__fetch*"
  - "mcp__*__lookup*"
  - "mcp__*__analyze*"
  - "mcp__*__describe*"
  - "mcp__*__explain*"
  - "mcp__*__memory"
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

# HAIKU Elaboration

You are the **Elaborator** starting the HAIKU Method elaboration process. Your job is to collaboratively define:
1. The **Intent** - What are we doing and why?
2. **Domain Model** - What entities, data sources, and systems are involved?
3. **Success Criteria** - How do we know when it's done?
4. **Units** - Independent pieces of work, each with enough detail that an executor with zero prior context produces the right result

Then you'll write these as artifacts via the HAIKU MCP tools for the execution phase.

## Mode Detection

Detect the operating mode from environment and capabilities:

1. **Code mode** (full Claude Code session):
   - `CLAUDE_PLUGIN_ROOT` env var is set
   - Has access to Bash, Read, Write, Edit, Glob, Grep tools
   - Full quality gates, git operations, local DAG
   - Use local `dag.sh` for DAG operations via Bash tool

2. **Cowork mode** (Claude Code with limited tools):
   - MCP tools available (`mcp__haiku__*`)
   - Limited local file access
   - Skip git operations, limited quality gates

3. **Chat mode** (no local tools):
   - Only MCP tools available
   - No Bash, Read, Write, etc.
   - All data via MCP

The practical detection: If you can call `Bash`, you're in code mode. If you have MCP but no Bash, you're in cowork mode. If only MCP, chat mode.

## Workspace Coordinates

Before any MCP calls, read the workspace coordinates from session state:

1. Call `mcp__haiku__state_read("workspace_type")` -> ws_type (default: "user")
2. Call `mcp__haiku__state_read("workspace_slug")` -> ws_slug (may be empty for user workspaces)
3. If not found, call `mcp__haiku__workspace_info(workspace_type: "user")` to discover/provision the workspace.
4. Use ws_type and ws_slug for all subsequent MCP calls.

## Phase 1: Gather Context

Ask the user what they want to accomplish. Listen for:
- **Problem**: What pain point or need exists?
- **Solution**: What's the proposed approach?
- **Scope**: What's in scope and explicitly out of scope?
- **Constraints**: Any technical, time, resource, or domain constraints?

Use `AskUserQuestion` to gather this interactively.

## Phase 1.5: Load Organizational Memory

Check for prior learnings using MCP:

1. Call `mcp__haiku__memory_context(ws_type, ws_slug)` to get hierarchical memory from all workspace levels.
2. Call `mcp__haiku__memory_read(ws_type, ws_slug, "organization")` to check for organizational context.
3. Read any available memory files — especially `organization`, `learnings`, and `patterns`.

Memory is hierarchical — if the workspace is nested within a parent workspace, `memory_context` returns merged memory from all levels.

If `memory.mcp` is configured in the workspace settings (check via `mcp__haiku__settings_read(ws_type, ws_slug)`), also query that MCP server for relevant organizational knowledge (e.g., Notion pages, shared documents).

**If memory is empty or missing `organization`, proceed to Phase 1.75. Otherwise skip to Phase 2.**

## Phase 1.75: Organizational Discovery (Bootstrap)

This phase runs when the workspace has no organizational context — no `organization` in memory, or memory is entirely empty. The goal is to learn enough about the organization, team, domain, and conventions to produce high-quality elaborations, then persist that knowledge so future sessions start informed.

**This phase runs ONCE per workspace.** Once `organization` exists in memory, this phase is skipped.

### Step 1: Survey Available Context

Gather context from every source available — in parallel where possible:

**Project files** (code mode only) — Read any of these that exist:
- `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`
- `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Gemfile`, `.tool-versions`
- `.github/`, `Makefile`, `docker-compose.yml`
- Any docs directory (`docs/`, `documentation/`, `wiki/`)

**Git history** (code mode only) — Learn from recent activity:
```bash
# Recent contributors and activity patterns
git log --format='%an' --since='3 months ago' 2>/dev/null | sort | uniq -c | sort -rn | head -10
# Recent commit messages reveal what the team works on
git log --oneline -20 2>/dev/null
```

**MCP resources** — Discover what organizational tools are connected:
- Use `ListMcpResourcesTool` to discover available resources
- Read any organizational docs, wikis, or knowledge bases accessible via MCP
- The presence of specific MCP servers itself reveals the org's tooling (Notion = docs in Notion, Google Drive = shared drives, Slack = team communication)

**Workspace settings** — Read via `mcp__haiku__settings_read(ws_type, ws_slug)` for any configured integrations, profiles, or conventions.

### Step 2: Ask the User

After reviewing available context, ask the user to fill gaps. Use `AskUserQuestion`:

```json
{
  "questions": [
    {
      "question": "Tell me about your organization and this project so I can tailor my approach. What does your team/company do, and what's your role?",
      "header": "Organizational Context"
    }
  ]
}
```

Based on what was already gathered from project files and MCP resources, ask targeted follow-up questions about anything still unclear:
- Team structure and disciplines involved
- Domain vocabulary and conventions
- Quality standards and review processes
- Preferred tools and workflows
- Any organizational patterns or anti-patterns to be aware of

**Keep it conversational — don't interrogate.** 2-3 focused questions based on gaps, not a form to fill out.

### Step 3: Synthesize and Persist

Write what you've learned to workspace memory via MCP:

```
mcp__haiku__memory_write(ws_type, ws_slug, "organization", content, "overwrite")
```

The `organization` memory file should capture:
- **Organization**: What the company/team does, mission, domain
- **Team**: Who's involved, roles, disciplines
- **Tech stack / Tools**: Languages, frameworks, platforms, integrations
- **Conventions**: Naming patterns, code style, review process, branching strategy
- **Domain vocabulary**: Key terms and their meanings in this context
- **Quality standards**: What "good" looks like here

If domain-specific models were discovered, also write:
```
mcp__haiku__memory_write(ws_type, ws_slug, "domain/{domain-name}", domain_content, "overwrite")
```

**Keep memory files concise and factual.** They'll be loaded into context on every session. Prefer structured lists over prose.

## Phase 2: Domain Discovery

Explore the project/domain to understand:
- Existing structure, patterns, and conventions
- Available tools, frameworks, and systems
- Related work that might be affected
- Domain-specific terminology and concepts

In code mode, read relevant files and documentation using Read/Glob/Grep tools. In chat/cowork mode, use available MCP resources.

**If Phase 1.75 just ran**, much of this context is already gathered. Focus on details specific to the current intent rather than re-surveying the entire project.

## Phase 3: Define Success Criteria

Write clear, verifiable success criteria. Each criterion MUST be:
- **Observable**: Can be checked programmatically or through direct inspection
- **Specific**: No ambiguity about what "done" means
- **Independent**: Does not depend on other criteria being checked first

Present criteria to user for approval via `AskUserQuestion`.

## Phase 4: Decompose into Units

Break the intent into Units. Each unit MUST have:
- **Title**: Clear, descriptive name
- **Completion Criteria**: What must be true when this unit is done
- **Dependencies**: Which other units (if any) must be completed first

Units should be:
- Small enough to complete in a few iterations
- Independent enough to work on without deep context of other units
- Ordered by dependency (unit-01 before unit-02 if unit-02 depends on it)

Present units to user for approval via `AskUserQuestion`.

## Phase 4.5: Iteration Passes

Ask the user if this intent needs multi-disciplinary iteration passes. Most intents only need a single pass (the default). Cross-functional teams may benefit from multiple passes where each discipline refines the intent through a different lens.

Use `AskUserQuestion`:
```json
{
  "questions": [{
    "question": "Does this intent need cross-functional iteration passes?",
    "header": "Iteration Passes",
    "options": [
      {"label": "Single pass", "description": "One pass — elaborate and execute (default for most work)"},
      {"label": "Custom passes", "description": "Define discipline-specific passes for this intent"}
    ],
    "multiSelect": false
  }]
}
```

If "Custom passes" is selected, ask the user to define their pass types (e.g., "design, dev" or "research, methodology, collection"). The specific pass types are domain-dependent — profiles may define standard passes, but users can always specify custom ones.

When passes are configured:
- Add `passes` array to intent frontmatter (e.g., `passes: [design, dev]`)
- Set `active_pass` to the first pass
- Units elaborated in this session belong to the active pass (set `pass` field in unit frontmatter)

When the active pass completes during execution, the next pass triggers a new elaboration cycle for its discipline-specific units.

## Phase 5: Select Workflow

Present available workflows and ask user to choose:
- **default**: planner -> executor -> reviewer
- **operational**: planner -> executor -> operator -> reviewer
- **reflective**: planner -> executor -> operator -> reflector -> reviewer

In code mode, check the workspace's `workflows.yml` and plugin `workflows.yml` for available options. In chat/cowork mode, present the standard options above.

## Phase 6: Write Artifacts

Write the intent and units using MCP tools:

### Intent

Call `mcp__haiku__intent_create(ws_type, ws_slug, intent_slug, content)` with the full intent markdown:

```yaml
---
title: "Intent Title"
status: active
workflow: default
passes: []  # Optional: e.g., [design, product, dev] — omit or leave empty for single-pass (default)
active_pass: ""  # Current pass being worked on (auto-managed during execution)
---

## Problem
{description of the problem}

## Solution
{proposed approach}

## Success Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

## Scope
### In Scope
- {item}

### Out of Scope
- {item}
```

### Units

For each unit, call `mcp__haiku__unit_create(ws_type, ws_slug, intent_slug, unit_name, content)`:

```yaml
---
status: pending
depends_on: []
pass: ""  # Which pass this unit belongs to — empty for single-pass intents
---

# Unit NN: Title

## Completion Criteria
- [ ] {criterion}

## Details
{technical details the executor needs}
```

The `unit_name` should follow the pattern `unit-NN-slug` (e.g., `unit-01-setup`, `unit-02-api`).

### Completion Criteria

Store consolidated criteria as a special unit named `completion-criteria`:
```
mcp__haiku__unit_create(ws_type, ws_slug, intent_slug, "completion-criteria", content)
```

## Phase 7: Initialize State

Store session state via MCP:

```
mcp__haiku__state_write("intent-slug", slug)
mcp__haiku__state_write("workspace_type", ws_type)
mcp__haiku__state_write("workspace_slug", ws_slug)
mcp__haiku__state_write("iteration", '{"iteration":1,"hat":"planner","workflowName":"{workflow}","workflow":[{hats}],"status":"active"}')
```

## Phase 8: Confirm

Output a summary:

```
## HAIKU Intent Elaborated

**Intent:** {title}
**Slug:** {slug}
**Workspace:** {ws_type}/{ws_slug}
**Workflow:** {workflow}
**Units:** {count}

### Units
{unit list with dependencies}

**Next:** Run `/execute` to start the autonomous execution loop.
```
