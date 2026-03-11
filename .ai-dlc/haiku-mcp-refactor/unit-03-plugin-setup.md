---
status: pending
depends_on: [unit-01-workspace-hierarchy]
branch: ai-dlc/haiku-mcp-refactor/03-plugin-setup
discipline: backend
workflow: ""
ticket: ""
---

# unit-03-plugin-setup

## Description
Add MCP server configuration to the plugin and rewrite the `/setup` skill to use MCP tools instead of filesystem shell libraries. This unit establishes the plugin's connection to the HAIKU MCP server and creates the onboarding flow that configures workspace_type and slug for all subsequent skill operations.

## Discipline
backend — This unit modifies the HAIKU plugin (Claude Code plugin with skills, hooks, and configuration).

## Domain Entities
- **Plugin Configuration**: `plugin/.mcp.json` declaring the HAIKU MCP server endpoint.
- **Setup Flow**: The `/setup` skill that onboards users, discovers their workspace, and configures the plugin.

## Data Sources
- **MCP tools** (from units 01-02): `workspace_info`, `settings_read`, `settings_write`, `memory_write`
- **Plugin filesystem**: `plugin/.mcp.json` (read-only, ships with plugin)

## Technical Specification

### 1. Plugin MCP Configuration
Create `plugin/.mcp.json`:
```json
{
  "mcpServers": {
    "haiku": {
      "type": "http",
      "url": "https://mcp.haikumethod.ai/mcp"
    }
  }
}
```
This file is read by Claude Code when the plugin is installed, making the HAIKU MCP tools available in all sessions.

### 2. Rewrite `/setup` Skill
Current `/setup` skill (in `plugin/skills/setup/SKILL.md`):
- Sources `workspace.sh` and `memory.sh`
- Calls `resolve_workspace()` to find/create local `.haiku/` directory
- Writes `settings.yml` to filesystem
- Writes `memory/organization.md` to filesystem
- Discovers MCP tools for integrations (Notion, Jira, etc.)

New `/setup` skill:
- **No shell library sourcing** — all operations via MCP tools
- **Step 1: Verify MCP connectivity** — Instruct Claude to call `workspace_info` with a test workspace_type to verify the HAIKU MCP server is connected and authenticated. If not authenticated, guide the user through the OAuth flow.
- **Step 2: Discover workspace** — Ask the user which workspace level they're working in:
  - "Personal project" → `workspace_type: "user"` (no slug needed)
  - "Team project" → `workspace_type: "team"`, ask for team slug
  - "Organization-wide" → `workspace_type: "org"`, ask for org slug
- **Step 3: Provision workspace** — Call `workspace_info` to check if workspace exists. If not provisioned, the MCP server auto-provisions on first access.
- **Step 4: Organizational discovery** — Same as current: survey project artifacts, README, package.json, etc. But write results via `memory_write(workspace_type, slug, "organization", content)` instead of filesystem.
- **Step 5: Configure settings** — Write initial `settings.yml` via `settings_write(workspace_type, slug, content)` with workflow, gates, and provider configurations.
- **Step 6: Save workspace context** — Store the `workspace_type` and `slug` in Claude's session context (via `state_write` MCP tool or environment variable) so subsequent skills know which workspace to target.

### 3. Remove Shell Library Dependencies
The rewritten `/setup` skill must NOT contain:
- `source "${CLAUDE_PLUGIN_ROOT}/lib/workspace.sh"`
- `source "${CLAUDE_PLUGIN_ROOT}/lib/memory.sh"`
- Any `resolve_workspace()`, `memory_write()`, or filesystem path references

Instead, skill instructions tell Claude to call MCP tools directly:
```
Use the `memory_write` MCP tool with:
- workspace_type: {configured workspace type}
- slug: {configured slug}
- name: "organization"
- content: {the organizational context you discovered}
```

### 4. Update Hooks
- **Keep** `capture-transcript.sh` (SessionStart) — it captures transcript path for `/reflect`, no MCP needed.
- **Remove** `subagent-context.sh` (PreToolUse) — context injection now happens in-flow via skill instructions.
- Update `hooks.json` to remove the PreToolUse entry.

## Success Criteria
- [ ] `plugin/.mcp.json` exists and correctly declares the HAIKU MCP server endpoint
- [ ] `/setup` skill completes without sourcing any shell libraries, using only MCP tools for all workspace operations
- [ ] `/setup` guides user through workspace type selection (user/team/org) and stores the choice for subsequent skills
- [ ] `subagent-context.sh` hook and its PreToolUse registration are removed from `hooks.json`

## Risks
- **MCP connectivity failure during setup**: User may not have authenticated with the MCP server yet. Mitigation: `/setup` detects unauthenticated state and guides user through OAuth flow before proceeding.
- **Breaking existing setups**: Users with existing `.haiku/` directories won't be automatically migrated. Mitigation: document migration path; `/setup` can detect existing local workspace and offer to migrate memory to MCP.

## Boundaries
This unit handles ONLY `/setup` and plugin configuration. All other skills (elaborate, execute, etc.) are rewritten in unit-04. This unit does NOT modify the MCP server (units 01-02 handle that).

## Notes
- The plugin `.mcp.json` URL may need to be configurable for self-hosted instances. Consider whether the URL should be hardcoded or read from a config file. For now, hardcode `mcp.haikumethod.ai` — self-hosting is a future concern.
- The workspace_type and slug should be passed to every subsequent MCP tool call. Skills need a consistent way to reference these. Options: (a) store in session state via `state_write`, (b) use environment variables, (c) embed in skill instructions as parameters. Recommended: session state via `state_write("workspace_type", ...)` and `state_write("workspace_slug", ...)`.
