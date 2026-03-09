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

You are the **Setup Assistant** for H·AI·K·U. Your job is to configure a workspace for this project by resolving or creating the workspace, discovering organizational context, and writing settings.

This skill is **idempotent** — re-running `/setup` preserves existing settings as defaults.

---

## Pre-check: Reject Cowork Mode

```bash
if [ "${CLAUDE_CODE_IS_COWORK:-}" = "1" ]; then
  echo "ERROR: /setup cannot run in cowork mode."
  echo "Run this in a full Claude Code CLI session inside your project directory."
  exit 1
fi
```

If `CLAUDE_CODE_IS_COWORK=1`, stop immediately with the message above. Do NOT proceed.

---

## Phase 0: Check Existing Configuration

1. Check if a workspace is already configured:

```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/workspace.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/memory.sh"

WORKSPACE=$(resolve_workspace 2>/dev/null) || WORKSPACE=""
echo "workspace=$WORKSPACE"

if [ -n "$WORKSPACE" ]; then
  if [ -f "$WORKSPACE/settings.yml" ]; then
    cat "$WORKSPACE/settings.yml"
  fi
fi
```

2. Store:
   - `EXISTING_WORKSPACE`: resolved path or empty
   - `EXISTING_SETTINGS`: parsed settings or empty `{}`
   - `HAS_ORGANIZATION_MD`: whether `{workspace}/memory/organization.md` exists

---

## Phase 1: Configure Workspace

### If no workspace is configured

Ask where the workspace should live using `AskUserQuestion`:

```json
{
  "questions": [{
    "question": "Where should the H·AI·K·U workspace live?",
    "header": "Workspace Location",
    "options": [
      {"label": "Project-local", "description": ".haiku/ directory in this project (simple, single-project use)"},
      {"label": "Shared directory", "description": "A standalone directory that can be shared across projects"},
      {"label": "Custom path", "description": "Specify an exact path"}
    ],
    "multiSelect": false
  }]
}
```

Based on the answer:

- **Project-local**: Set `WORKSPACE=.haiku` and write `.haiku.yml`:
  ```yaml
  workspace: .haiku
  ```

- **Shared directory**: Ask for the path via `AskUserQuestion`. Default suggestion: `~/haiku-workspace`. Write `.haiku.yml`:
  ```yaml
  workspace: ~/haiku-workspace
  ```

- **Custom path**: Ask for the exact path via `AskUserQuestion`. Write `.haiku.yml` with the provided path.

Then create the workspace directory structure:

```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/workspace.sh"
WORKSPACE=$(resolve_workspace)
mkdir -p "$WORKSPACE/intents" "$WORKSPACE/memory"
```

### If workspace already exists

Show the current workspace path and ask if they want to keep it:

Use `AskUserQuestion`:
- "Workspace is configured at `{path}`. Keep this location?"
- Options: "Yes, keep it" / "Change location"

If **"Change location"** → run the workspace creation flow above.

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

**If `organization.md` already exists in workspace memory**, read it and show a summary. Ask if they want to update it or keep it.

**If `organization.md` does not exist**, run discovery:

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

Write what you've learned to workspace memory:

```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/memory.sh"
memory_write "organization" "$CONTENT" "overwrite"
```

The `organization.md` file should capture:
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
      {"label": "default", "description": "planner → executor → reviewer (standard for most work)"},
      {"label": "operational", "description": "planner → executor → operator → reviewer (includes operational handoff)"},
      {"label": "reflective", "description": "planner → executor → operator → reflector → reviewer (full lifecycle with reflection)"}
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

## Phase 5: Write Settings File

1. Read existing `settings.yml` if it exists to preserve manual edits.

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

3. Write the file using the `Write` tool to `{workspace}/settings.yml`.

---

## Phase 6: Confirmation

Display a final summary:

```
## H·AI·K·U Setup Complete

| Setting | Value |
|---------|-------|
| Workspace | ~/haiku-workspace |
| Default Workflow | default |
| Memory Backend | filesystem |
| Quality Gates | none |
| Organization | ✓ discovered |

Settings written to `{workspace}/settings.yml`.
```

If organizational context was discovered or updated, note it:

```
Organizational context saved to `{workspace}/memory/organization.md`.
```

List detected MCP integrations if any:

```
Detected integrations: Notion, Slack
```

Finish with:

```
Next: Run `/elaborate` to start your first intent.
```
