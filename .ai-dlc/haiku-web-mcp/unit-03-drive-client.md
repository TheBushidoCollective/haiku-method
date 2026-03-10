---
status: pending
depends_on: [unit-02-google-oauth]
branch: ai-dlc/haiku-web-mcp/03-drive-client
discipline: backend
workflow: ""
ticket: ""
---

# unit-03: Google Drive Client Module

## Description
Build a reusable Google Drive client module that abstracts Drive API v3 operations behind HAIKU workspace semantics. This is the foundation unit that both workspace provisioning (unit-04), MCP tools (unit-05), and the dashboard (unit-06) depend on. It accepts an OAuth access token per-call (no stored credentials) and provides typed functions for workspace operations.

## Discipline
backend - This unit will be executed by backend-focused agents.

## Domain Entities
- **Workspace Folder**: A Google Drive folder representing a HAIKU workspace. Has a root folder, `memory/` subfolder, and `settings.yml` file.
- **Memory File**: A markdown file inside a workspace's `memory/` folder. Named like `organization.md`, `learnings.md`, `patterns.md`, or `domain/{name}.md`.
- **Settings File**: A YAML file (`settings.yml`) at the workspace root containing HAIKU workspace configuration.

## Data Sources
- Google Drive API v3 via `googleapis` npm package
  - `drive.files.create` — create folders and files
  - `drive.files.get` — get file metadata
  - `drive.files.list` — list files in a folder
  - `drive.files.update` — update file content
  - `drive.files.export` / `drive.files.get` with `alt=media` — read file content

## Technical Specification

### Module Structure
```
src/
  lib/
    drive/
      client.ts               # DriveClient class — core Drive API wrapper
      workspace.ts             # Workspace-level operations (provision, read memory, etc.)
      types.ts                 # TypeScript types for Drive operations
```

### DriveClient Class (`client.ts`)
A stateless client that accepts an access token per operation. No constructor state — pure functions wrapped in a class for organization.

```typescript
class DriveClient {
  // Folder operations
  static async createFolder(token: string, name: string, parentId?: string): Promise<string> // returns folder ID
  static async listFolder(token: string, folderId: string): Promise<DriveFile[]>
  static async findFolder(token: string, name: string, parentId: string): Promise<string | null>

  // File operations
  static async createFile(token: string, name: string, content: string, mimeType: string, parentId: string): Promise<string>
  static async readFile(token: string, fileId: string): Promise<string>
  static async updateFile(token: string, fileId: string, content: string): Promise<void>
  static async findFile(token: string, name: string, parentId: string): Promise<string | null>
  static async deleteFile(token: string, fileId: string): Promise<void>
}
```

### Workspace Operations (`workspace.ts`)
Higher-level operations that compose DriveClient primitives into HAIKU workspace semantics.

```typescript
// Provision a new workspace folder structure
async function provisionWorkspace(token: string, name: string, parentId?: string): Promise<WorkspaceInfo>
// Returns: { folderId, memoryFolderId, settingsFileId }

// Memory operations
async function readMemory(token: string, workspaceFolderId: string, name: string): Promise<string | null>
async function writeMemory(token: string, workspaceFolderId: string, name: string, content: string, mode: 'overwrite' | 'append'): Promise<void>
async function listMemory(token: string, workspaceFolderId: string): Promise<string[]>

// Settings operations
async function readSettings(token: string, workspaceFolderId: string): Promise<string | null>
async function writeSettings(token: string, workspaceFolderId: string, content: string): Promise<void>

// Workspace info
async function getWorkspaceInfo(token: string, workspaceFolderId: string): Promise<WorkspaceInfo>
```

### Types (`types.ts`)
```typescript
interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
}

interface WorkspaceInfo {
  folderId: string
  memoryFolderId: string | null
  settingsFileId: string | null
  memoryFiles: string[]
}
```

### Drive API Patterns
- Use `googleapis` package: `google.drive({ version: 'v3', auth: oauth2Client })`
- Create OAuth2 client per-request with the provided access token: `oauth2Client.setCredentials({ access_token: token })`
- All files use `application/vnd.google-apps.document` for Google Docs or `text/plain` for plain text — use plain text (markdown files should be stored as plain text, not Google Docs format)
- Folder MIME type: `application/vnd.google-apps.folder`
- File queries use `'${parentId}' in parents and name = '${name}' and trashed = false`

### Dependencies
- `googleapis` (Google APIs client library — includes Drive v3)

## Success Criteria
- [ ] `DriveClient` can create folders, create/read/update files, and list folder contents using a provided access token
- [ ] `provisionWorkspace()` creates a folder structure with root folder, `memory/` subfolder, and `settings.yml` with default content
- [ ] `readMemory()` / `writeMemory()` / `listMemory()` correctly read, write (overwrite and append modes), and list markdown files in the workspace's `memory/` folder
- [ ] All functions accept an access token parameter and never store or cache tokens

## Risks
- **Drive API rate limits**: Google Drive API has per-user and per-project rate limits. Mitigation: Operations are infrequent (memory read/write per session, not high-throughput). Add basic error handling for 429 responses.
- **File name collisions**: Multiple calls to `provisionWorkspace` could create duplicate folders. Mitigation: `provisionWorkspace` should check if folder exists first (idempotent).

## Boundaries
This unit does NOT handle: database operations or org/team records (unit-04), MCP protocol (unit-05), or UI (unit-06). It is a pure Google Drive abstraction layer with no knowledge of PostgreSQL entities.

## Notes
- The `googleapis` package is large — consider using `@googleapis/drive` (standalone Drive client) instead for smaller bundle size
- All operations should be idempotent where possible (create-if-not-exists pattern)
- Memory append mode: read existing content, concatenate new content with newline separator, write back. There's no atomic append in Drive API.
- Error handling: wrap Drive API errors into typed errors (e.g., `DriveNotFoundError`, `DrivePermissionError`, `DriveQuotaError`)
