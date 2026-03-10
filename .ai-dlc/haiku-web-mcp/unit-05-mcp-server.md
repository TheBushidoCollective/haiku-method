---
status: completed
depends_on: [unit-03-drive-client, unit-04-workspace-provisioning]
branch: ai-dlc/haiku-web-mcp/05-mcp-server
discipline: backend
workflow: ""
ticket: ""
---

# unit-05: MCP Server with Drive-Backed Tools

## Description
Implement the MCP server endpoint using `@modelcontextprotocol/sdk` with Streamable HTTP transport. Register HAIKU-specific tools (memory_read, memory_write, memory_list, settings_read, settings_write, workspace_info) that proxy operations to Google Drive via the Drive client module (unit-03). Authenticate each request via the Bearer token provided by Claude Code.

## Discipline
backend - This unit will be executed by backend-focused agents.

## Domain Entities
- **MCP Session**: Stateless — each request is independent. No session state stored.
- **MCP Tools**: Named operations exposed to Claude Code. Each maps to Drive client operations.
- **Workspace**: Resolved per-request from the authenticated user's team memberships and a `workspace` parameter in tool arguments.

## Data Sources
- Google Drive API v3 (via Drive client module): All tool operations
- PostgreSQL (via Drizzle): Workspace resolution (user → memberships → team → drive_folder_id)
- Google OAuth 2.0 token info endpoint: Token validation (`https://oauth2.googleapis.com/tokeninfo?access_token=TOKEN`)

## Technical Specification

### MCP Server Setup

In `server.ts` (the custom Express server from unit-01), mount the MCP endpoint:

```typescript
// server.ts additions
import { createMcpServer } from './src/mcp/server'

const mcpHandler = await createMcpServer()
app.post('/mcp', mcpHandler.handlePost)
app.get('/mcp', mcpHandler.handleGet)
app.delete('/mcp', mcpHandler.handleDelete)
```

### MCP Server Module
```
src/
  mcp/
    server.ts                  # McpServer creation + tool registration
    auth.ts                    # Bearer token extraction + Google token validation
    workspace-resolver.ts      # Token → user → team memberships → workspace folder IDs
    tools/
      memory.ts                # memory_read, memory_write, memory_list tools
      settings.ts              # settings_read, settings_write tools
      workspace.ts             # workspace_info tool
```

### Authentication Flow (per-request)
1. Extract `Authorization: Bearer <token>` from request headers
2. Validate token with Google: `GET https://oauth2.googleapis.com/tokeninfo?access_token=<token>`
3. Extract `email` and `sub` (Google user ID) from token info response
4. Look up user in PostgreSQL by `google_id` (the `sub` value)
5. If user not found: return MCP error "User not registered"
6. If user found: proceed with the user's context

### Workspace Resolution
Tools need to know WHICH workspace to operate on. Each tool accepts a `team_slug` parameter (or `org_slug` + `team_slug`):

1. Look up user's team memberships from PostgreSQL
2. Find the team matching the provided slug
3. Verify membership exists (authorization check)
4. Return the team's `drive_folder_id`

For org-level workspace access: use the organization's `drive_folder_id` directly.

### Tool Definitions

**memory_read**
```typescript
server.tool("memory_read", "Read a memory file from the workspace", {
  team_slug: z.string().describe("Team slug to identify the workspace"),
  name: z.string().describe("Memory file name (e.g., 'learnings', 'organization', 'patterns', 'domain/api')")
}, async ({ team_slug, name }, { request }) => {
  const { token, user } = await authenticateRequest(request)
  const folderId = await resolveWorkspace(user, team_slug)
  const content = await readMemory(token, folderId, name)
  return { content: [{ type: "text", text: content ?? "Memory file not found" }] }
})
```

**memory_write**
```typescript
server.tool("memory_write", "Write or append to a memory file in the workspace", {
  team_slug: z.string(),
  name: z.string().describe("Memory file name"),
  content: z.string().describe("Content to write"),
  mode: z.enum(["overwrite", "append"]).default("append").describe("Write mode")
}, async ({ team_slug, name, content, mode }, { request }) => {
  const { token, user } = await authenticateRequest(request)
  const folderId = await resolveWorkspace(user, team_slug)
  await writeMemory(token, folderId, name, content, mode)
  return { content: [{ type: "text", text: `Memory '${name}' updated (${mode})` }] }
})
```

**memory_list**
```typescript
server.tool("memory_list", "List all memory files in the workspace", {
  team_slug: z.string()
}, async ({ team_slug }, { request }) => {
  const { token, user } = await authenticateRequest(request)
  const folderId = await resolveWorkspace(user, team_slug)
  const files = await listMemory(token, folderId)
  return { content: [{ type: "text", text: JSON.stringify(files) }] }
})
```

**settings_read**
```typescript
server.tool("settings_read", "Read workspace settings.yml", {
  team_slug: z.string()
}, async ({ team_slug }, { request }) => {
  const { token, user } = await authenticateRequest(request)
  const folderId = await resolveWorkspace(user, team_slug)
  const settings = await readSettings(token, folderId)
  return { content: [{ type: "text", text: settings ?? "No settings found" }] }
})
```

**settings_write**
```typescript
server.tool("settings_write", "Update workspace settings.yml", {
  team_slug: z.string(),
  content: z.string().describe("Full settings.yml content (YAML)")
}, async ({ team_slug, content }, { request }) => {
  const { token, user } = await authenticateRequest(request)
  const folderId = await resolveWorkspace(user, team_slug)
  await writeSettings(token, folderId, content)
  return { content: [{ type: "text", text: "Settings updated" }] }
})
```

**workspace_info**
```typescript
server.tool("workspace_info", "Get workspace metadata and structure", {
  team_slug: z.string()
}, async ({ team_slug }, { request }) => {
  const { token, user } = await authenticateRequest(request)
  const folderId = await resolveWorkspace(user, team_slug)
  const info = await getWorkspaceInfo(token, folderId)
  // Also include org/team metadata from PostgreSQL
  return { content: [{ type: "text", text: JSON.stringify(info) }] }
})
```

### MCP Server Configuration
```typescript
const server = new McpServer({
  name: "haiku-method",
  version: "1.0.0",
  description: "HAIKU Method workspace memory and settings via Google Drive"
})

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined  // stateless — tokens come per-request
})
```

### OAuth Metadata (for Claude Code auto-discovery)
When Claude Code connects and gets a 401, it looks for OAuth metadata. Implement:
- `GET /.well-known/oauth-authorization-server` — returns OAuth metadata pointing to Google's auth endpoints
- Or configure Claude Code with `--client-id` and Google's OAuth endpoints directly

This enables Claude Code's built-in OAuth flow to open the browser and authenticate with Google.

### Dependencies
- `@modelcontextprotocol/sdk` (MCP TypeScript SDK)
- `zod` (tool input validation — already a dependency)

## Success Criteria
- [ ] MCP endpoint at `/mcp` accepts POST requests with JSON-RPC messages and returns valid MCP responses
- [ ] Claude Code can connect via `claude mcp add --transport http haiku https://haiku.railway.app/mcp` and discover all 6 tools
- [ ] `memory_read` returns content of a memory file from the authenticated user's workspace on Google Drive
- [ ] `memory_write` creates a new memory file or appends to an existing one in the workspace
- [ ] `memory_list` returns the list of all memory files in the workspace's memory/ folder
- [ ] All tool calls fail with an appropriate error if the Bearer token is invalid or the user doesn't have access to the requested workspace

## Risks
- **Token validation latency**: Calling Google's tokeninfo endpoint on every request adds latency. Mitigation: Consider a short-lived in-memory cache (e.g., 60s TTL) keyed by token hash. The token is validated once, cached briefly.
- **MCP SDK transport access to request headers**: The SDK's tool handler may not directly expose HTTP headers. Mitigation: Use Express middleware to extract the Bearer token and attach it to a request-scoped context that the transport can access.
- **OAuth metadata for Claude Code**: Claude Code needs to discover OAuth endpoints to initiate the flow. Mitigation: Implement `/.well-known/oauth-authorization-server` or document manual `claude mcp add` with `--client-id` and `--callback-port`.

## Boundaries
This unit does NOT handle: the Drive client implementation (unit-03 — already built), workspace provisioning logic (unit-04 — already built), or dashboard UI (unit-06). It only implements the MCP protocol layer and tool registration.

## Notes
- The MCP SDK's `StreamableHTTPServerTransport` in stateless mode creates a new transport per request — use the `handleRequest(req, res, body)` pattern from the Express integration
- For authentication context, the approach is: Express middleware extracts Bearer token → attaches to `req` → transport handler accesses it from the request object
- Consider using MCP Resources in addition to tools — e.g., expose memory files as resources that Claude Code can @ mention
- Server instructions field in McpServer config should describe when to use each tool (helps with Claude Code's Tool Search feature)
