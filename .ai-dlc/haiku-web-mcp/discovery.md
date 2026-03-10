---
intent: haiku-web-mcp
created: 2026-03-09
status: active
---

# Discovery Log: HAIKU Web App + MCP Server

Elaboration findings persisted during Phase 2.5 domain discovery.
Builders: read section headers for an overview, then dive into specific sections as needed.


## External Research: MCP Streamable HTTP Transport

**Discovered:** 2026-03-09

### Findings
- MCP spec version 2025-03-26 defines Streamable HTTP as the primary remote transport (replacing SSE)
- Server exposes a single HTTP endpoint (e.g., `/mcp`) supporting POST and GET methods
- POST: Client sends JSON-RPC messages; server responds with `application/json` or `text/event-stream`
- GET: Client opens SSE stream for server-initiated messages
- Session management via `Mcp-Session-Id` header (assigned at initialization)
- Official TypeScript SDK: `@modelcontextprotocol/sdk` provides `StreamableHTTPServerTransport`
- Claude Code connects to remote MCP servers via `claude mcp add --transport http <name> <url>`

### Authentication
- Claude Code supports OAuth 2.0 for remote MCP servers
- OAuth flow: server returns 401 → Claude Code discovers OAuth metadata → browser-based auth → token exchange
- Also supports Bearer token via `--header "Authorization: Bearer ${TOKEN}"`
- OAuth tokens stored securely and refreshed automatically
- `/mcp` command in Claude Code handles authentication flows

### Key Observations
- Server MUST validate Origin header to prevent DNS rebinding
- Server SHOULD implement proper authentication
- Sessions are stateful — server assigns session ID at initialization
- SSE streaming enables real-time progress updates during tool execution

### Architecture Implications
- Our MCP server needs a single `/mcp` endpoint handling POST/GET
- Must implement OAuth 2.0 authorization server metadata endpoint
- Google OAuth can serve dual purpose: user auth AND Google Drive API access
- Railway deployment works well — it's just an HTTP server

## External Research: Claude Code MCP Integration

**Discovered:** 2026-03-09

### Findings
- Claude Code adds remote servers via: `claude mcp add --transport http <name> <url>`
- Supports scopes: local (default), project (.mcp.json), user (global)
- OAuth authentication via `/mcp` command in Claude Code
- Plugin-provided MCP servers auto-start with plugins (via .mcp.json or plugin.json inline)
- MCP resources accessible via @ mentions
- Tool Search dynamically loads tools when many are available

### Plugin MCP Configuration
- Plugins can bundle MCP servers in `.mcp.json` at plugin root
- Or inline in `plugin.json` under `mcpServers` key
- Supports `${CLAUDE_PLUGIN_ROOT}` variable expansion
- Automatic lifecycle management

### Key Observations
- Our web app could be added as a remote MCP server users configure
- Could also be bundled as a plugin MCP server for the HAIKU plugin
- Google OAuth flow would be triggered via `/mcp` in Claude Code

## External Research: Google Drive as Memory Storage

**Discovered:** 2026-03-09

### Findings
- Google OAuth 2.0 provides Drive API access with appropriate scopes
- Key scopes: `drive.file` (app-created files only) or `drive` (full access)
- `drive.file` is recommended — limits access to files the app creates
- Google Drive API v3 supports: files, folders, shared drives, permissions
- TypeScript SDK: `googleapis` npm package provides typed Drive API client

### Memory Storage Design
- Workspace memory maps to Google Drive folders
- Hierarchical workspaces → nested Drive folder structure
- Memory files (learnings.md, patterns.md, etc.) → Drive documents
- Shared drives → team workspaces (everyone on team has access)
- Individual Drive → personal workspace memory

### Data Model Mapping
- Organization (HAIKU) → Google Drive Shared Drive or top-level folder
- Team workspace → subfolder within org folder
- Memory files → markdown files in workspace folder
- Settings → JSON/YAML files in workspace folder


## External Research: MCP TypeScript SDK Server Pattern

**Discovered:** 2026-03-09

### Findings
- Official SDK: `@modelcontextprotocol/sdk`
- Key imports: `McpServer` from `sdk/server/mcp.js`, `StreamableHTTPServerTransport` from `sdk/server/streamableHttp.js`
- Express middleware available: `@modelcontextprotocol/express` with `createMcpExpressApp()`
- Tools registered via `server.tool(name, description, schema, handler)` using Zod schemas
- Resources registered via `server.resource(name, uri, handler)`
- Prompts registered via `server.prompt(name, description, handler)`

### Server Pattern
```typescript
const server = new McpServer({ name: "haiku-mcp", version: "1.0.0" });
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await server.connect(transport);
app.post('/mcp', (req, res) => transport.handleRequest(req, res, req.body));
```

### Stateless vs Stateful
- Stateless: `sessionIdGenerator: undefined` — new transport per request, good for serverless
- Stateful: Assign session IDs, maintain transport per session, support GET for SSE streams
- For our use case: stateful makes sense (user sessions with Google Drive access)

### Key Observations
- Express is the standard integration path
- Zod for tool input validation
- Can easily add auth middleware before MCP routes
- The MCP endpoint is just a regular HTTP route — can coexist with dashboard routes

## Architecture Decision: Tech Stack

**Discovered:** 2026-03-09

### Decision
Full-stack TypeScript with:
- **Runtime**: Node.js on Railway
- **Web Framework**: Express (needed for MCP SDK integration)
- **Frontend**: React with Next.js App Router (SSR dashboard)
- **MCP Server**: `@modelcontextprotocol/sdk` with `StreamableHTTPServerTransport`
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Google OAuth 2.0 (via next-auth/Auth.js)
- **Google Drive**: `googleapis` npm package for Drive API v3

### Rationale
- Express is the standard MCP SDK integration path — `@modelcontextprotocol/express` middleware
- Next.js provides SSR dashboard with excellent DX, can use custom server for Express MCP routes
- Drizzle ORM: type-safe, lightweight, excellent PostgreSQL support, migration tooling
- Auth.js: mature Google OAuth integration, handles token refresh, stores tokens securely
- Single TypeScript codebase for both dashboard and MCP server

### Deployment
- Railway: Docker container running custom Next.js server with Express
- PostgreSQL: Railway managed PostgreSQL instance
- Single service: Dashboard (Next.js) + MCP endpoint (Express) on same port
- Environment: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`


## Architecture Decision: Thin Proxy with Client-Side Tokens

**Discovered:** 2026-03-09

### Decision
The web app is a thin authenticated proxy to Google Drive. No Google OAuth tokens are stored server-side.

### Token Flow (MCP)
1. Claude Code connects to MCP server → 401
2. Claude Code opens browser → Google OAuth
3. Token stored in Claude Code's local keychain (macOS) / secure credential store
4. Each MCP request includes `Authorization: Bearer <token>`
5. MCP server validates token with Google, uses it for Drive API calls per-request
6. Server NEVER persists the token

### Token Flow (Dashboard)
- Dashboard uses standard OAuth session (short-lived cookie)
- Session stores user identity, not Drive tokens
- Dashboard Drive operations use the session's OAuth token (held in memory/session store only)

### PostgreSQL Schema (Minimal)
- users: id, google_id, email, name, avatar_url (NO tokens)
- organizations: id, name, slug, drive_folder_id
- teams: id, org_id, name, slug, drive_folder_id
- memberships: user_id, team_id, role

### Security Properties
- DB compromise exposes NO credentials — only identity mappings
- Token scope limited to `drive.file` (app-created files only)
- Each user's Drive access is their own — no service account acting on behalf

## Architecture Decision: MCP Server Design

**Discovered:** 2026-03-09

### MCP Tools Surface
| Tool | Description | Drive Operation |
|------|-------------|-----------------|
| memory_read | Read a memory file | GET file content from workspace memory folder |
| memory_write | Write/append to memory | UPDATE/CREATE file in workspace memory folder |
| memory_list | List memory files | LIST files in workspace memory folder |
| settings_read | Read workspace settings | GET settings.yml content |
| settings_write | Update workspace settings | UPDATE settings.yml |
| workspace_info | Get workspace metadata | GET folder structure + org/team info |

### Stateless Per-Request
- No session management needed (tokens come per-request)
- sessionIdGenerator: undefined (stateless mode)
- Each request: validate token → resolve workspace → execute Drive operation → return

