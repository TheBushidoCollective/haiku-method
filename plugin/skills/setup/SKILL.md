---
name: setup
description: Configure H·AI·K·U for this project — set up workspace, discover organizational context, and configure settings.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - ToolSearch
  - ListMcpResourcesTool
  - ReadMcpResourceTool
  # HAIKU MCP tools
  - mcp__haiku__workspace_info
  - mcp__haiku__settings_read
  - mcp__haiku__settings_write
  - mcp__haiku__memory_read
  - mcp__haiku__memory_write
  - mcp__haiku__memory_list
  # MCP read-only tool patterns (discovery only, no writes)
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
---

# HAIKU Setup

You are the **Setup Assistant** for H·AI·K·U. Your job is to configure a workspace for this project by provisioning a cloud-backed workspace via the HAIKU MCP server, discovering organizational context, and writing settings.

This skill is **idempotent** — re-running `/setup` preserves existing settings as defaults.

---

## Phase 0: Check Existing Configuration

1. Call `mcp__haiku__workspace_info` with `workspace_type: "user"` to check if a workspace already exists.

2. If the call succeeds (workspace exists):
   - Read current settings via `mcp__haiku__settings_read` with the returned workspace_type and slug.
   - Check for existing organizational memory via `mcp__haiku__memory_read` with `name: "organization"`.

3. Store:
   - `EXISTING_WORKSPACE`: workspace_type and slug from the response, or empty
   - `EXISTING_SETTINGS`: parsed settings or empty `{}`
   - `HAS_ORGANIZATION`: whether organization memory was found

---

## Phase 1: Configure Workspace

### If no workspace is configured

Ask the user what level of workspace they need using `AskUserQuestion`:

```json
{
  "questions": [{
    "question": "What level of H·AI·K·U workspace do you want to set up?",
    "header": "Workspace Level",
    "options": [
      {"label": "User", "description": "Personal workspace for your own projects"},
      {"label": "Team", "description": "Shared workspace for a team (requires a team slug)"},
      {"label": "Organization", "description": "Organization-wide workspace (requires an org slug)"}
    ],
    "multiSelect": false
  }]
}
```

Based on the answer:

- **User**: Set `workspace_type: "user"`, no slug needed.
- **Team**: Ask for team slug via `AskUserQuestion`. Set `workspace_type: "team"` and store the slug.
- **Organization**: Ask for org slug via `AskUserQuestion`. Set `workspace_type: "org"` and store the slug.

Then call `mcp__haiku__workspace_info` with the chosen `workspace_type` (and `slug` if team/org) to provision or verify the workspace.

Store `workspace_type` and `slug` for all subsequent MCP calls in this session.

### If workspace already exists

Show the current workspace type and slug and ask if they want to keep it:

Use `AskUserQuestion`:
- "Workspace is configured as `{workspace_type}` (slug: `{slug}`). Keep this configuration?"
- Options: "Yes, keep it" / "Change configuration"

If **"Change configuration"** -> run the workspace creation flow above.

---

## Phase 2: Probe MCP Tools for Integrations

Use `ToolSearch` to discover available MCP providers. Run **all probes in parallel**:

| Category | Search Terms |
|----------|-------------|
| Knowledge | `"notion"`, `"confluence"`, `"google docs"` |
| Communication | `"slack"`, `"teams"`, `"discord"` |
| Storage | `"google drive"`, `"dropbox"`, `"onedrive"` |
| Project Management | `"jira"`, `"linear"`, `"asana"`, `"trello"` |

Also:
- Use `ListMcpResourcesTool` as a secondary signal for available MCP servers

Build a detection results map of what's available. This informs which integrations can be configured.

---

## Phase 3: Organizational Discovery

**If organization memory already exists** (found in Phase 0), read it via `mcp__haiku__memory_read` with `name: "organization"` and show a summary. Ask if they want to update it or keep it.

**If organization memory does not exist**, run discovery:

### Step 1: Survey Available Context

Gather context from every source available — in parallel where possible:

**Project files** — Read any of these that exist:
- `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`
- `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Gemfile`, `.tool-versions`
- `.github/`, `Makefile`, `docker-compose.yml`
- Any docs directory (`docs/`, `documentation/`, `wiki/`)

**Git history** — Learn from recent activity:
```bash
# Recent contributors and activity patterns
git log --format='%an' --since='3 months ago' 2>/dev/null | sort | uniq -c | sort -rn | head -10
# Recent commit messages reveal what the team works on
git log --oneline -20 2>/dev/null
```

**MCP resources** — Use discoveries from Phase 2:
- Read any organizational docs, wikis, or knowledge bases accessible via MCP
- The presence of specific MCP servers reveals the org's tooling

### Step 2: Ask the User

After reviewing available context, ask the user to fill gaps. Use `AskUserQuestion`:

```json
{
  "questions": [
    {
      "question": "Tell me about your organization and this project so I can tailor H·AI·K·U. What does your team/company do, and what's your role?",
      "header": "Organizational Context"
    }
  ]
}
```

Based on what was already gathered, ask targeted follow-up questions about anything still unclear:
- Team structure and disciplines involved
- Domain vocabulary and conventions
- Quality standards and review processes
- Preferred tools and workflows

**Keep it conversational — 2-3 focused questions based on gaps, not a form.**

### Step 3: Synthesize and Persist

Write what you've learned to workspace memory via MCP:

Call `mcp__haiku__memory_write` with:
- `workspace_type`: the configured workspace type
- `slug`: the configured slug (if team/org)
- `name`: `"organization"`
- `content`: the synthesized organizational context
- `mode`: `"overwrite"`

The organization memory should capture:
- **Organization**: What the company/team does, mission, domain
- **Team**: Who's involved, roles, disciplines
- **Tech stack / Tools**: Languages, frameworks, platforms, integrations
- **Conventions**: Naming patterns, style, review process
- **Domain vocabulary**: Key terms and their meanings in this context
- **Quality standards**: What "good" looks like here

**Keep memory files concise and factual.**

---

## Phase 4: Configure Settings

Build the workspace settings interactively. Pre-fill from existing settings if re-running.

### Default Workflow

Use `AskUserQuestion`:
```json
{
  "questions": [{
    "question": "What default workflow should new intents use?",
    "header": "Default Workflow",
    "options": [
      {"label": "default", "description": "planner -> executor -> reviewer (standard for most work)"},
      {"label": "operational", "description": "planner -> executor -> operator -> reviewer (includes operational handoff)"},
      {"label": "reflective", "description": "planner -> executor -> operator -> reflector -> reviewer (full lifecycle with reflection)"}
    ],
    "multiSelect": false
  }]
}
```

### Memory Backend

If MCP knowledge tools were detected in Phase 2 (Notion, Confluence, Google Drive), ask:

Use `AskUserQuestion`:
```json
{
  "questions": [{
    "question": "Where should organizational memory be stored?",
    "header": "Memory Backend",
    "options": [
      {"label": "Filesystem (default)", "description": "Store memory in the workspace's memory/ directory"},
      {"label": "{detected-provider}", "description": "Sync memory with {provider} via MCP"}
    ],
    "multiSelect": false
  }]
}
```

If no knowledge MCP tools were detected, skip this question — filesystem is used automatically.

### Quality Gates

Use `AskUserQuestion`:
```json
{
  "questions": [{
    "question": "Do you want to configure quality gates? Gates enforce standards before work advances.",
    "header": "Quality Gates",
    "options": [
      {"label": "None for now", "description": "Skip gates — you can add them later in settings.yml"},
      {"label": "Manual review gate", "description": "Require human approval before advancing"},
      {"label": "Custom", "description": "Define custom gate commands or criteria"}
    ],
    "multiSelect": false
  }]
}
```

If **"Manual review gate"**: add a manual review gate to settings.
If **"Custom"**: ask the user to describe their gate(s), then configure accordingly.

---

## Phase 5: Write Settings

1. Read existing settings via `mcp__haiku__settings_read` (if workspace existed) to preserve manual edits.

2. Merge new values over existing. Build the YAML structure:

```yaml
workflow: default

memory:
  mcp: notion  # Only include if user selected an MCP backend

gates:
  - name: Review
    type: manual
    event: Advance
```

Rules:
- Only include `memory.mcp` if user selected an MCP backend
- Only include `gates` if user configured gates
- Preserve any fields not covered by this wizard
- Output must validate against `plugin/schemas/settings.schema.json`

3. Write settings via `mcp__haiku__settings_write` with:
   - `workspace_type`: the configured workspace type
   - `slug`: the configured slug (if team/org)
   - `settings`: the YAML content string

---

## Phase 6: Confirmation

Display a final summary:

```
## H·AI·K·U Setup Complete

| Setting | Value |
|---------|-------|
| Workspace Type | user |
| Workspace Slug | — |
| Default Workflow | default |
| Memory Backend | filesystem |
| Quality Gates | none |
| Organization | discovered |

Settings written via HAIKU MCP server (cloud-backed).
```

If organizational context was discovered or updated, note it:

```
Organizational context saved to workspace memory via MCP.
```

List detected MCP integrations if any:

```
Detected integrations: Notion, Slack
```

Finish with:

```
Next: Run `/elaborate` to start your first intent.
```
