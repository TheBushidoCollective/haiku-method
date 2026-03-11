---
status: completed
depends_on: []
branch: ai-dlc/haiku-mcp-refactor/01-workspace-hierarchy
discipline: backend
workflow: ""
ticket: ""
---

# unit-01-workspace-hierarchy

## Description
Expand the MCP server to support three workspace levels (user, team, org) with Google Shared Drive access for team and org workspaces. Currently the server only resolves team-level workspaces via `team_slug`. This unit adds user workspace (personal My Drive folder) and org workspace (Shared Drive folder), updates OAuth scopes for Shared Drive access, and modifies all existing tools to accept a `workspace_type` parameter.

## Discipline
backend — This unit modifies the MCP server (Next.js/Express + Drizzle ORM + Google Drive API).

## Domain Entities
- **Workspace**: Gains three types — `user`, `team`, `org`. Each resolves to a different Drive location.
- **Organization**: Already exists in DB. Gains `driveFolderId` support for Shared Drive (field exists but unused for MCP).
- **User**: Already exists in DB. Gains a personal workspace folder in My Drive.

## Data Sources
- **PostgreSQL** (Drizzle ORM): `users`, `organizations`, `teams`, `memberships` tables. Read for workspace resolution.
- **Google Drive API v3**: Create/read folders in My Drive (user workspace) and Shared Drives (team/org workspace). Requires `supportsAllDrives=true` parameter for Shared Drive operations.
- **Google OAuth**: Expand scopes to include Shared Drive access.

## Technical Specification

### 1. OAuth Scope Expansion
In `web/src/mcp/oauth.ts`, update the `scope` parameter in `handleOAuthAuthorize`:
- Current: `openid email profile https://www.googleapis.com/auth/drive.file`
- New: `openid email profile https://www.googleapis.com/auth/drive`
- The broader `drive` scope is needed because `drive.file` only accesses files created by the app, which won't cover existing Shared Drive folders.

### 2. Drive Client Updates
In `web/src/lib/drive/client.ts`:
- Add `supportsAllDrives: true` and `includeItemsFromAllDrives: true` parameters to all Drive API calls (files.list, files.create, files.get, files.update, files.delete).
- This enables the existing Drive client to work with Shared Drives without changing the API surface.

### 3. Workspace Resolver Expansion
In `web/src/mcp/workspace-resolver.ts`:
- Current: `resolveWorkspace(db, userId, teamSlug)` → returns team workspace
- New: `resolveWorkspace(db, userId, workspaceType, slug?)` where:
  - `workspaceType: "user"` → resolve user's personal workspace (My Drive folder, stored in `users.driveFolderId` — new column)
  - `workspaceType: "team"` → resolve team workspace (existing behavior, uses `team_slug`)
  - `workspaceType: "org"` → resolve org workspace (Shared Drive folder, uses `org_slug`, resolves via `organizations.driveFolderId`)
- Add `org_slug` support: look up org by slug, verify user has membership in any team within that org.
- Add user workspace provisioning: create `haiku-workspace/` folder in user's My Drive if not exists.

### 4. Database Schema Updates
In `web/src/db/schema.ts`:
- Add `driveFolderId: text("drive_folder_id")` to `users` table (for personal workspace folder ID)
- The `organizations` table already has `driveFolderId` — verify it's used for org workspace resolution.

### 5. Tool Parameter Updates
All existing MCP tools (`memory_read`, `memory_write`, `memory_list`, `settings_read`, `settings_write`, `workspace_info`) in `web/src/mcp/tools/`:
- Replace `team_slug` parameter with two parameters:
  - `workspace_type: "user" | "team" | "org"` (required)
  - `slug: string` (required for team/org, ignored for user)
- Update tool descriptions to explain the three workspace levels.
- Update internal calls to use the expanded workspace resolver.

### 6. Workspace Provisioning
In `web/src/lib/drive/workspace.ts`:
- Update `provisionWorkspace()` to handle all three types:
  - User: creates `haiku-workspace/` in My Drive with `memory/` subfolder and `settings.yml`
  - Team: existing behavior (creates in team's Shared Drive folder)
  - Org: creates `haiku-workspace/` in org's Shared Drive folder

## Success Criteria
- [ ] MCP tools accept `workspace_type` parameter (user/team/org) and `slug` parameter, resolving to the correct Drive location
- [ ] Shared Drive operations work (create folders, read/write files in Shared Drives) with proper `supportsAllDrives` flags
- [ ] User workspace is provisioned in My Drive on first access
- [ ] Org workspace resolves via org slug and verifies user has membership in any org team

## Risks
- **OAuth scope broadening**: Moving from `drive.file` to `drive` gives broader access. Mitigation: the MCP server only accesses HAIKU workspace folders, never arbitrary Drive files. Document this in the consent screen.
- **Shared Drive permissions**: Users may not have Shared Drive access in their Google Workspace. Mitigation: graceful error when Shared Drive is not available.

## Boundaries
This unit does NOT handle: session state (unit-02), memory hierarchy (unit-02), plugin changes (units 03-04), or intent/unit CRUD tools (unit-02). It only expands the workspace resolution and Drive access layer.

## Notes
- Test with both personal Google accounts (no Shared Drives) and Google Workspace accounts (with Shared Drives)
- The `supportsAllDrives` flag is backward-compatible — it works for both My Drive and Shared Drives
- Migration: existing team workspaces continue to work; the `team_slug` → `workspace_type: "team", slug: team_slug` change is additive
