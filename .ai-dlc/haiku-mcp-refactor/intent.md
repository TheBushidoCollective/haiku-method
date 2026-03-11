---
workflow: default
git:
  change_strategy: intent
  auto_merge: true
  auto_squash: false
announcements: []
created: 2026-03-10
status: active
epic: ""
---

# HAIKU Plugin MCP Refactor

## Problem
The HAIKU plugin currently uses filesystem-based shell libraries (memory.sh, storage.sh, workspace.sh) to persist workspace data locally. This ties HAIKU to environments with filesystem access (Claude Code only) and prevents it from working in chat or cowork modes. Organizational knowledge is siloed per machine rather than shared across the team via a central "company brain."

## Solution
Refactor the plugin to be MCP-native. All workspace data (memory, settings, intents, state) flows through MCP tools to Google Drive. The MCP server is expanded to support three workspace levels (user, team, org) with hierarchical memory inheritance. Shell libraries for filesystem I/O are removed; skills instruct Claude to use MCP tools directly. The plugin works identically in chat, cowork, and code modes.

## Domain Model

### Entities
- **Workspace** — A knowledge base backed by Google Drive. Three levels: user (My Drive), team (Shared Drive), org (Shared Drive). Contains memory, settings, and intents.
- **Memory** — Organizational knowledge that compounds over time. Markdown files in `{workspace}/memory/`. Inherits upward through hierarchy (user sees user + team + org memory).
- **Settings** — Workflow definitions, quality gates, workspace preferences. YAML file at `{workspace}/settings.yml`.
- **Intent** — A specific initiative with scope, success criteria, and unit decomposition. Markdown files on Drive via MCP.
- **Unit** — An independent piece of work within an intent. Markdown with YAML frontmatter for status, dependencies, pass type.
- **State** — Ephemeral session tracking (current hat, workflow position, unit progress). Lives in-memory on MCP server, lost when session ends.
- **Hat** — Behavioral role (planner, executor, reviewer, etc.). Ships with plugin, stateless instructions.
- **Workflow** — Ordered sequence of hats. Configurable per workspace.

### Relationships
- Workspace **nests within** parent Workspace (org > team > user)
- Workspace **contains** Memory, Settings, Intents
- Memory **inherits upward** through workspace hierarchy
- Intent **contains** Units (DAG)
- State **tracks** Intent execution (ephemeral)
- Hat **is worn by** subagent during execution
- Workflow **sequences** Hats

### Data Sources
- **Google Drive API v3** (via MCP server): Stores all workspace data as markdown files. My Drive for user workspaces, Shared Drives for team/org workspaces.
- **PostgreSQL** (via Drizzle ORM): Users, organizations, teams, memberships. Maps team_slug to Drive folder IDs.
- **MCP Server** (mcp.haikumethod.ai): HTTP-based MCP endpoint exposing tools for memory, settings, workspace, state, and intent operations.
- **Plugin hats/workflows**: Local read-only files shipping with the plugin.

### Data Gaps
- MCP server currently only supports team-level workspace — needs user and org levels
- No Shared Drive support — OAuth scope `drive.file` insufficient for team/org workspaces
- No session state tools — need ephemeral in-memory state
- No hierarchical memory — need `memory_context` that merges across levels
- No `memory_delete` tool
- No intent/unit CRUD tools on MCP server

## Success Criteria
- [ ] MCP server exposes workspace tools at three levels: user, team, and org — each backed by the appropriate Drive location (My Drive for user, Shared Drive for team/org)
- [ ] MCP server supports ephemeral session state (read/write within session lifecycle, lost on session end)
- [ ] MCP server supports hierarchical memory reads (memory_context returns merged user + team + org memory)
- [ ] OAuth scopes include Shared Drive access for team/org workspaces
- [ ] Plugin `.mcp.json` exposes the HAIKU MCP server connection
- [ ] All plugin skills (setup, elaborate, execute, advance, operate, reflect, resume) use MCP tools instead of filesystem shell libraries for memory, settings, and workspace operations
- [ ] Shell libraries `memory.sh`, `storage.sh` are removed; `workspace.sh` is reduced to local-only helpers or removed
- [ ] `subagent-context.sh` hook is removed (context injection happens in-flow via skills)
- [ ] Plugin works in chat, cowork, and code modes (no git/filesystem dependency for core HAIKU operations)
- [ ] All existing HAIKU lifecycle phases (elaborate → execute → operate → reflect) function correctly through MCP

## Context
- The MCP server already exists at mcp.haikumethod.ai with 5 tools (memory_read, memory_write, memory_list, settings_read, settings_write, workspace_info)
- OAuth 2.0 proxy to Google is already implemented (RFC 8414 metadata, authorize, token endpoints)
- Current OAuth scope is `drive.file` — needs expansion for Shared Drive access
- The HAIKU paper explicitly envisions MCP-backed workspaces: "A workspace can be backed by a knowledge management system via MCP"
- Intent files are stored as markdown on Drive (text/plain), edited via MCP only, readable in Drive as escape hatch
- State is ephemeral and session-scoped — dies with the session, no long-term persistence of user tokens beyond request lifecycle
