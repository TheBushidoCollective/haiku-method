---
status: pending
depends_on: [unit-02-state-and-memory, unit-03-plugin-setup]
branch: ai-dlc/haiku-mcp-refactor/04-skill-rewrite
discipline: backend
workflow: ""
ticket: ""
---

# unit-04-skill-rewrite

## Description
Rewrite all remaining plugin skills (elaborate, execute, advance, operate, reflect, resume) to use MCP tools instead of filesystem shell libraries. Remove `memory.sh`, `storage.sh`, and `workspace.sh`. Reduce or remove shell library dependencies. Ensure all skills work in chat, cowork, and code modes.

## Discipline
backend — This unit modifies the HAIKU plugin skills (markdown instruction files).

## Domain Entities
- **Skills**: `/elaborate`, `/execute`, `/advance`, `/operate`, `/reflect`, `/resume` — all 6 remaining skills.
- **Shell Libraries**: `memory.sh`, `storage.sh`, `workspace.sh` — targeted for removal.
- **Hats**: Unchanged (stateless, no filesystem dependency).

## Data Sources
- **MCP tools** (from units 01-02): All workspace, memory, settings, state, intent, and unit tools.
- **Plugin filesystem** (read-only): Hat definitions in `plugin/hats/`, workflow definitions in `plugin/workflows.yml`.
- **Local files** (code mode only): DAG operations via `dag.sh` when AI-DLC is running in code mode.

## Technical Specification

### Shell Library Removal Plan

| Library | Action | Rationale |
|---------|--------|-----------|
| `memory.sh` | **Delete** | All memory operations replaced by MCP tools (memory_read, memory_write, memory_list, memory_context) |
| `storage.sh` | **Delete** | State persistence replaced by MCP state tools (state_read, state_write) and intent tools (intent_read, intent_write) |
| `workspace.sh` | **Delete** | Workspace resolution replaced by MCP workspace_info. Path helpers no longer needed since skills don't reference local paths. |
| `config.sh` | **Keep, simplify** | Quality gates (`run_gates`) execute local shell commands — this is inherently local. Settings loading switches to MCP (`settings_read`) but gate execution stays in shell. Remove workspace.sh dependency. |
| `dag.sh` | **Keep** | DAG operations read local unit files during AI-DLC code execution. Keep for code mode compatibility. In chat/cowork mode, skills use MCP unit tools instead. |

### Skill Rewrite Pattern

Each skill currently follows this pattern:
```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/workspace.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/storage.sh"
WORKSPACE=$(resolve_workspace)
STATE=$(storage_load_state "iteration.json")
# ... filesystem operations
```

The new pattern removes all shell sourcing. Instead, skill markdown instructs Claude:
```markdown
## Step 1: Load workspace context
Read workspace context by calling the `state_read` MCP tool with key "workspace_type"
and "workspace_slug" to determine the active workspace.

## Step 2: Load iteration state
Call the `state_read` MCP tool with key "iteration" to get the current
hat, workflow, and status.

## Step 3: {skill-specific work}
...using MCP tools for all read/write operations...
```

### Per-Skill Changes

#### `/elaborate`
Current dependencies: workspace.sh, storage.sh, memory.sh, dag.sh
- Replace `resolve_workspace()` → `state_read("workspace_type")` + `state_read("workspace_slug")`
- Replace `memory_read("organization")` → MCP `memory_read(workspace_type, slug, "organization")`
- Replace `storage_save_state("intent-slug", ...)` → MCP `state_write("intent-slug", ...)`
- Replace `storage_save_state("iteration.json", ...)` → MCP `state_write("iteration", ...)`
- Replace writing intent.md/unit-*.md to filesystem → MCP `intent_create` and `unit_create` tools
- Remove all `source` commands for shell libraries

#### `/execute`
Current dependencies: workspace.sh, storage.sh, dag.sh, config.sh
- Replace `storage_load_state("iteration.json")` → MCP `state_read("iteration")`
- Replace `find_ready_units()` → MCP `unit_list` + parse frontmatter status from each unit's content
- Replace `update_unit_status()` → MCP `unit_read` + `unit_write` (update frontmatter in content)
- Replace `run_gates()` → keep local (config.sh) for code mode; skip gates in chat/cowork mode
- Hat file loading stays local (plugin/hats/ directory)
- Subagent spawning stays the same but context comes from MCP reads instead of hook injection

#### `/advance`
Current dependencies: workspace.sh, storage.sh, dag.sh
- Replace `storage_load_state` → MCP `state_read`
- Replace `get_dag_summary()` → MCP `unit_list` + parse each unit's status
- Replace `update_unit_status()` → MCP `unit_read` + `unit_write`
- Replace `storage_save_state("iteration.json")` → MCP `state_write("iteration", ...)`

#### `/operate`
Current dependencies: workspace.sh, storage.sh
- Replace `storage_load_state("operation-status.json")` → MCP `state_read("operation-status")`
- Replace reading `operations.md` → MCP `intent_read` for the operations file
- Replace `storage_save_state("operation-status.json")` → MCP `state_write("operation-status", ...)`

#### `/reflect`
Current dependencies: workspace.sh, storage.sh, dag.sh, memory.sh
- Replace `storage_load_state` calls → MCP `state_read`
- Replace `get_dag_summary()` → MCP `unit_list` + parse statuses
- Replace `memory_write("learnings", ...)` → MCP `memory_write(workspace_type, slug, "learnings", ...)`
- Replace writing `reflection.md` → MCP tool to write reflection as an intent artifact
- Transcript reading stays local (`$HAIKU_TRANSCRIPT_PATH` from capture-transcript.sh hook)

#### `/resume`
Current dependencies: workspace.sh, storage.sh, dag.sh
- Replace workspace scanning → MCP `intent_list` to find active intents
- Replace intent metadata reading → MCP `intent_read` + parse frontmatter
- Replace `storage_save_state` → MCP `state_write`
- Replace `get_recommended_hat()` → read unit statuses via MCP `unit_list` + `unit_read`, determine hat locally from workflow definition

### Mode-Aware Behavior

Skills must detect the operating mode and adapt:
- **Chat mode**: No filesystem access. All operations via MCP. No quality gates (no shell to run them). No git operations.
- **Cowork mode**: Limited filesystem access. All operations via MCP. Limited quality gates.
- **Code mode (Claude Code)**: Full filesystem access. MCP for shared data. Local DAG cache for fast operations. Full quality gates. Git operations for AI-DLC.

Detection: Check `$CLAUDE_CODE_IS_COWORK` env var and whether git is available.

## Success Criteria
- [ ] All 6 skills (elaborate, execute, advance, operate, reflect, resume) function correctly using MCP tools with no filesystem shell library sourcing
- [ ] `memory.sh`, `storage.sh`, and `workspace.sh` are deleted from `plugin/lib/`
- [ ] `config.sh` is simplified (no workspace.sh dependency, settings loaded via MCP)
- [ ] Skills detect operating mode (chat/cowork/code) and adapt behavior accordingly
- [ ] The full HAIKU lifecycle (elaborate → execute → operate → reflect) completes successfully using only MCP for shared data

## Risks
- **Skill size**: Each SKILL.md file is large (hundreds of lines of instructions). Rewriting all 6 is significant work. Mitigation: follow the consistent pattern (replace source → MCP tool calls) and test each skill individually.
- **DAG operations latency in non-code modes**: Without local file caching, every DAG query requires multiple MCP calls (unit_list + unit_read for each unit). Mitigation: use `unit_list` which returns all unit names, then batch `unit_read` calls. Consider adding a `unit_list_with_status` tool to the MCP server that returns names + frontmatter in one call.
- **Mode detection fragility**: Relying on env vars to detect chat vs cowork vs code may be fragile. Mitigation: default to MCP-only mode (safest), enable local optimizations only when explicitly detected.

## Boundaries
This unit does NOT modify the MCP server (units 01-02) or the `/setup` skill (unit-03). It does NOT change hat definitions or workflow definitions (they're already mode-agnostic). It does NOT implement local caching for AI-DLC code mode — that's future work.

## Notes
- The skill rewrite is primarily a text change (markdown instructions), not a code change. The "code" being written is the instruction text that tells Claude how to use MCP tools.
- Hat files remain unchanged — they're stateless behavioral specs that don't reference storage.
- `dag.sh` stays for now but may be deprecated in a future intent once MCP-native DAG operations are proven stable.
- Consider adding a `unit_list_with_status` convenience tool to the MCP server to reduce chattiness — this could be a fast-follow enhancement.
