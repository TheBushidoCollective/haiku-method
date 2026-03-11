---
intent: haiku-mcp-refactor
created: 2026-03-10
status: active
---

# Discovery Log: HAIKU Plugin MCP Refactor

Elaboration findings persisted during Phase 2.5 domain discovery.
Builders: read section headers for an overview, then dive into specific sections as needed.


## Codebase Pattern: Plugin Shell Libraries

**Discovered:** 2026-03-10

### Overview
5 shell library files in `plugin/lib/` providing filesystem-based operations:

### memory.sh → MCP replacement candidate
- `memory_read(name)` — reads `{workspace}/memory/{name}.md`
- `memory_write(name, content, mode)` — writes to `{workspace}/memory/{name}.md`
- `memory_list()` — lists memory files
- `memory_context(max_lines)` — reads ALL memory with hierarchical inheritance (walks parent workspaces)
- `memory_dir()` — returns memory directory path

### storage.sh → MCP replacement candidate
- `storage_save_state(key, value)` — saves to `{workspace}/intents/{slug}/state/{key}`
- `storage_load_state(key)` — loads from state dir
- `storage_save_unit_state(unit, key, value)` — unit-scoped state
- `storage_load_unit_state(unit, key)` — unit-scoped state
- `storage_list_keys(prefix)` / `storage_delete_state(key)` — state management

### workspace.sh → Partially MCP, partially local
- `resolve_workspace()` — walks directory tree looking for `.haiku.yml`, reads `workspace` field
- `workspace_intents_dir()` / `workspace_intent_dir(slug)` — path helpers
- `workspace_settings_file()` — returns `{workspace}/settings.yml`
- `workspace_hats_dir()` / `workspace_workflows_file()` — path helpers
- `resolve_memory_dirs()` — walks hierarchy collecting memory dirs (hierarchical inheritance)
- `resolve_hat_file(hat)` — resolves hat: workspace override > plugin default

### config.sh → Stays local (reads intent.md frontmatter + settings.yml)
- `load_haiku_setting(key, default)` — reads workspace settings.yml
- `load_gates()` / `get_event_gates(event)` / `run_gates(event)` — quality gates from `{workspace}/gates.json`
- `get_haiku_config(intent_dir)` — merged config (intent frontmatter > settings > defaults)
- `export_haiku_config(intent_dir)` — exports as env vars

### dag.sh → Stays local (reads unit-*.md files in git)
- YAML parsing: `_yaml_get_simple()`, `_yaml_get_array()`
- Unit parsing: `parse_unit_status()`, `parse_unit_deps()`, `parse_unit_pass()`
- Dependency resolution: `are_deps_completed()`, `find_ready_units()`, etc.
- Status: `get_dag_status_table()`, `get_dag_summary()`, `is_dag_complete()`
- Mutation: `update_unit_status()`, `validate_dag()`

### Key Observations
- memory.sh and storage.sh are pure filesystem read/write — direct MCP replacement candidates
- workspace.sh's hierarchy resolution needs rethinking (currently walks filesystem)
- config.sh reads local files (settings.yml, gates.json, intent.md) — stays local
- dag.sh operates on git-tracked unit files — stays local
- Environment vars: `HAIKU_WORKSPACE`, `HAIKU_INTENT_SLUG`, `CLAUDE_PLUGIN_ROOT`

### MCP Migration Map
| Library | Functions | Destination |
|---------|-----------|-------------|
| memory.sh | All 5 functions | MCP tools: memory_read, memory_write, memory_list |
| storage.sh | All 7 functions | MCP tools: new state_read/state_write or memory-based |
| workspace.sh | resolve_workspace, resolve_memory_dirs | MCP tool: workspace_info |
| workspace.sh | path helpers (intents_dir, etc.) | Keep local (git paths) |
| config.sh | All 6 functions | Keep local (reads local YAML) |
| dag.sh | All 19 functions | Keep local (reads local unit files) |


## API Schema: MCP Server Tools

**Discovered:** 2026-03-10

### Exposed Tools (5 total)

#### Memory Tools
- **memory_read(team_slug, name)** → file content or "not found"
- **memory_write(team_slug, name, content, mode)** → success message; mode: "overwrite"|"append"
- **memory_list(team_slug)** → newline-separated file names

#### Settings Tools
- **settings_read(team_slug)** → YAML content of settings.yml
- **settings_write(team_slug, content)** → success message

#### Workspace Tools
- **workspace_info(team_slug)** → JSON: team metadata + Drive folder structure

### Authentication
- Google OAuth 2.0 Bearer tokens
- Token validated against Google `/tokeninfo` per request (no caching)
- User must exist in Postgres `users` table (created via web app sign-in)
- Team membership required for workspace access

### Data Model (Postgres + Drizzle)
- **users**: id, googleId, email, name, avatarUrl
- **organizations**: id, name, slug, driveFolderId, createdBy
- **teams**: id, orgId, name, slug, driveFolderId, createdBy
- **memberships**: id, userId, teamId, role (admin|member)

### Drive Storage Structure
```
{team.driveFolderId}/
├── memory/
│   ├── {file1}
│   ├── {file2}
│   └── ...
└── settings.yml
```

### Gaps / Missing MCP Tools
1. **No memory_delete** — cannot remove memory files via MCP
2. **No org-level access** — only team-level workspace, no org memory inheritance
3. **No workspace provisioning tool** — only via web app
4. **No state persistence tools** — storage.sh's state_save/state_load have no MCP equivalent
5. **No hierarchical memory** — memory_read only reads team-level, no parent workspace inheritance
6. **No memory subdirectory support** — memory_list is flat, no domain/ nesting

### Key Observations
- All tools require `team_slug` parameter — plugin needs to know which team to target
- Settings are plain text (no schema validation in MCP layer)
- Token validation per-request adds latency (no JWT caching)
- Concurrent writes are last-write-wins (no locking)


## Codebase Pattern: Plugin Skills

**Discovered:** 2026-03-10

### Skills and Their Shell Library Dependencies

| Skill | workspace.sh | storage.sh | memory.sh | config.sh | dag.sh |
|-------|-------------|-----------|----------|----------|--------|
| /setup | resolve_workspace, memory_write | - | memory_write | - | - |
| /elaborate | resolve_workspace | storage_save_state | memory_read | - | (implied) |
| /execute | resolve_workspace | load/save state | - | run_gates | find_ready_units, update_unit_status |
| /advance | resolve_workspace | load/save state | - | - | get_dag_summary, update_unit_status |
| /operate | resolve_workspace | load/save state | - | - | - |
| /reflect | resolve_workspace | load state | memory_write | - | get_dag_summary |
| /resume | resolve_workspace | storage_save_state | - | - | get_recommended_hat, get_dag_status_table |

### What Skills Write (MCP Migration Targets)

**Shared knowledge writes (→ MCP):**
- /setup: writes `{workspace}/memory/organization.md`, `{workspace}/settings.yml`
- /reflect: writes `{workspace}/memory/learnings.md` (close path)
- /elaborate: writes `{workspace}/memory/` (organizational context)

**Orchestration writes (→ stays local):**
- /elaborate: writes intent.md, unit-*.md, completion-criteria.md, state/iteration.json
- /execute: updates unit status (sed on unit-*.md), state/iteration.json
- /advance: updates unit status, state/iteration.json, intent.md active_pass
- /operate: writes state/operation-status.json
- /reflect: writes reflection.md, state/reflection-status.json

### Key Observation
Hats are stateless behavioral specs — NO filesystem or MCP dependencies. They're pure instructions for subagents. The skills handle all I/O.

### Gaps
- No skill currently calls MCP tools for memory — only references "optional MCP backend" in config
- storage.sh state persistence has no MCP equivalent
- All skills source shell libs via `source "${CLAUDE_PLUGIN_ROOT}/lib/*.sh"` — these are bash commands embedded in skill markdown


## External Research: HAIKU Paper

**Discovered:** 2026-03-10

### Memory Model (5 Layers)
1. **Rules** — Project config files (CLAUDE.md, etc.) — instant, loaded at session start
2. **Session** — Working files, scratchpads, iteration state — fast, ephemeral
3. **Workspace** — Intents, settings, workflows — indexed, persistent
4. **Organizational** — Learnings, patterns, domain models — query, compounds over time, inherits upward
5. **External** — Connected systems via MCP — query, institutional knowledge

### Workspace Design (Paper's Vision)
- "A workspace can be: a local directory, a shared cloud drive folder (Google Drive), or backed by a knowledge management system via MCP (Notion, etc.)"
- Workspaces nest hierarchically (company > team > project)
- Memory inherits UPWARD — engineering sees engineering + company memory
- Siblings are isolated (engineering can't see marketing)
- "Decouples knowledge from any single codebase"

### Feed-Forward Loop
Reflection → sharper criteria → Elaboration
         → better quality gates → Execution
         → improved operational plans → Operation
         → expanded organizational memory → richer context → Elaboration

### Protocol Integration
- MCP = "vertical integration layer" (agent ↔ tools/data)
- A2A = "horizontal integration layer" (agent ↔ agent)
- HAIKU designed to operate within both

### Key Quote
"The filesystem remains the simplest, most robust foundation for the first four layers. But these aren't the only options — MCP-backed workspaces can connect to external organizational memory, dramatically expanding what agents can know."


## Architecture Decision: Intent Storage

**Decided:** 2026-03-10

Markdown files on Google Drive via MCP. MCP-only editing (Claude/web app write, Drive is read-only for humans). Frontmatter stays intact because files are managed programmatically.

May revisit Google Docs format later if human editing in Drive becomes a real need.

## Architecture Decision: Workspace Hierarchy

**Decided:** 2026-03-10

Three workspace levels, all on Drive:
- **User workspace** → My Drive (personal learnings, settings)
- **Team workspace** → Shared Drive (team memory, team settings)
- **Org workspace** → Shared Drive (company-wide learnings, policies)

Memory inherits upward: user sees user + team + org memory.

## Architecture Decision: State Management

**Decided:** 2026-03-10

Ephemeral session state via MCP. Lost when session dies or new chat starts. AI-DLC caches locally for fast DAG operations during code execution, syncs back at hat boundaries.

## Architecture Decision: HAIKU is MCP-Native

**Decided:** 2026-03-10

HAIKU has NO git/filesystem dependency. Works in chat, cowork, or code mode. Everything flows through MCP to Google Drive. AI-DLC adds git/code concerns on top when in code mode.

- Intent artifacts → MCP (not git-tracked)
- All memory → MCP
- All settings → MCP
- All state → MCP (ephemeral)
- Hats/workflows → ship with plugin (read-only)
- DAG orchestration → AI-DLC layer (local cache from MCP)

## Architecture Decision: Drive Scopes

**Decided:** 2026-03-10

Need expanded OAuth scopes:
- Current: `drive.file` (only files app created)
- Needed: Shared Drive access for team/org workspaces
- User workspace: My Drive (drive.file may suffice)
- Team/Org workspace: Shared Drive (needs `drive` scope or shared drive-specific scope)

