---
status: completed
depends_on: [unit-01-workspace-hierarchy]
branch: ai-dlc/haiku-mcp-refactor/02-state-and-memory
discipline: backend
workflow: ""
ticket: ""
---

# unit-02-state-and-memory

## Description
Add ephemeral session state tools and hierarchical memory support to the MCP server. Session state lives in-memory (not Drive) and is lost when the session ends. Hierarchical memory merges content across workspace levels (user + team + org) to implement the HAIKU paper's memory inheritance model. Also adds memory_delete and intent/unit CRUD tools.

## Discipline
backend — This unit adds new MCP tools to the server.

## Domain Entities
- **State**: Ephemeral key-value store scoped to a session. Lives in server memory (Map), not persisted to Drive.
- **Memory**: Gains hierarchical reading via `memory_context` tool. Writes remain level-specific.
- **Intent**: New entity on MCP — CRUD for intent markdown files on Drive.
- **Unit**: New entity on MCP — CRUD for unit markdown files within an intent.

## Data Sources
- **Server memory** (Map/WeakMap): Ephemeral session state, keyed by session ID or request context.
- **Google Drive API v3**: Memory files across workspace hierarchy, intent/unit files.
- **Workspace resolver** (from unit-01): Resolves user/team/org workspaces for hierarchical memory reads.

## Technical Specification

### 1. Ephemeral Session State
Create `web/src/mcp/tools/state.ts` with tools:

- **`state_write(key, value)`**: Stores a key-value pair in server memory for the current session. No `workspace_type` — state is session-scoped, not workspace-scoped.
- **`state_read(key)`**: Reads a value by key. Returns empty if not found.
- **`state_list()`**: Lists all keys in the current session's state.
- **`state_delete(key)`**: Removes a key from session state.

Implementation: Use an in-memory `Map<string, Map<string, string>>` keyed by a session identifier. Since MCP is stateless HTTP (no persistent sessions), the "session" is identified by a combination of user ID + a client-provided `session_id` header (or generated per-request if not provided). State is stored in a global Map with a TTL (e.g., 1 hour) to prevent unbounded growth.

Note: Claude Code sends an `Mcp-Session-Id` header (or similar) in MCP requests. Use this as the session key. If not present, fall back to a request-scoped store (state only persists within a single request — less useful but safe).

### 2. Hierarchical Memory
Create `memory_context` tool in `web/src/mcp/tools/memory.ts`:

- **`memory_context(workspace_type, slug?, max_entries?)`**: Reads memory from the specified workspace level AND all parent levels, returning merged content. Order: most-specific first (user → team → org).
  - If `workspace_type: "user"`: reads user memory + team memory (from user's primary team) + org memory
  - If `workspace_type: "team"`: reads team memory + org memory
  - If `workspace_type: "org"`: reads org memory only
  - Each memory entry is labeled with its source level: `## [team: engineering] learnings.md`
  - `max_entries` limits the total number of memory files returned (default: 50)

Implementation: Make multiple Drive API calls (one per workspace level), aggregate results, format as labeled markdown sections.

### 3. Memory Delete
Add `memory_delete` tool in `web/src/mcp/tools/memory.ts`:

- **`memory_delete(workspace_type, slug?, name)`**: Deletes a memory file from the specified workspace. Uses Drive API `files.delete` (moves to trash).

### 4. Intent CRUD Tools
Create `web/src/mcp/tools/intents.ts` with tools:

- **`intent_create(workspace_type, slug?, intent_slug, content)`**: Creates `{workspace}/intents/{intent_slug}/intent.md` on Drive. Creates the `intents/` and `{intent_slug}/` folders if they don't exist.
- **`intent_read(workspace_type, slug?, intent_slug)`**: Reads `intent.md` content for a given intent.
- **`intent_write(workspace_type, slug?, intent_slug, content)`**: Updates `intent.md` content.
- **`intent_list(workspace_type, slug?)`**: Lists all intent slugs in the workspace (scans `intents/` folder for subdirectories).
- **`intent_delete(workspace_type, slug?, intent_slug)`**: Trashes the intent folder and all its contents.

### 5. Unit CRUD Tools
Create `web/src/mcp/tools/units.ts` with tools:

- **`unit_create(workspace_type, slug?, intent_slug, unit_name, content)`**: Creates `{workspace}/intents/{intent_slug}/{unit_name}.md`.
- **`unit_read(workspace_type, slug?, intent_slug, unit_name)`**: Reads unit file content.
- **`unit_write(workspace_type, slug?, intent_slug, unit_name, content)`**: Updates unit file content.
- **`unit_list(workspace_type, slug?, intent_slug)`**: Lists all unit files in an intent directory (files matching `unit-*.md`).
- **`unit_delete(workspace_type, slug?, intent_slug, unit_name)`**: Trashes a unit file.

### 6. Drive Workspace Updates
In `web/src/lib/drive/workspace.ts`:
- Add `createIntentFolder(driveFolderId, intentSlug)` — creates `intents/{intentSlug}/` folder structure
- Add `listIntents(driveFolderId)` — lists subdirectories under `intents/`
- Add `readIntentFile(driveFolderId, intentSlug, fileName)` — reads a file from intent directory
- Add `writeIntentFile(driveFolderId, intentSlug, fileName, content)` — creates or updates a file in intent directory
- Add `deleteIntentFolder(driveFolderId, intentSlug)` — trashes intent folder

## Success Criteria
- [ ] Session state tools (state_read, state_write, state_list, state_delete) work with ephemeral in-memory storage keyed by session
- [ ] `memory_context` tool returns merged memory from all parent workspace levels, labeled by source
- [ ] `memory_delete` tool removes memory files from the specified workspace
- [ ] Intent CRUD tools (create, read, write, list, delete) manage intent markdown files on Drive
- [ ] Unit CRUD tools (create, read, write, list, delete) manage unit files within intent directories on Drive
- [ ] State is automatically cleaned up after TTL expiry (no unbounded memory growth)

## Risks
- **Memory growth from session state**: If many sessions are active, the in-memory Map grows. Mitigation: TTL-based cleanup (1 hour), max entries per session (1000).
- **Hierarchical memory latency**: Reading from 3 workspace levels requires 3 Drive API calls. Mitigation: parallel Promise.all() calls; consider caching at the server level.
- **Intent folder structure**: Nested folders in Drive can be slow to traverse. Mitigation: use Drive API `q` parameter for efficient folder queries rather than recursive listing.

## Boundaries
This unit does NOT handle: OAuth scope changes or workspace resolver expansion (unit-01), plugin skill rewrites (units 03-04). It only adds new MCP tools on top of the expanded workspace resolver from unit-01.

## Notes
- The `Mcp-Session-Id` header behavior should be verified against the MCP spec — check if Claude Code sends a session identifier in HTTP MCP requests.
- If no session ID is available, the state tools still work but state is request-scoped (only useful within a single tool call chain).
- Intent/unit tools use the same workspace hierarchy as memory — an intent can live in a user workspace (personal project), team workspace (team project), or org workspace (company-wide initiative).
