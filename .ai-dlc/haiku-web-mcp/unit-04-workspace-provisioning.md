---
status: completed
depends_on: [unit-03-drive-client]
branch: ai-dlc/haiku-web-mcp/04-workspace-provisioning
discipline: backend
workflow: ""
ticket: ""
---

# unit-04: Google Drive Workspace Provisioning

## Description
Implement API routes for creating organizations and teams. When an org or team is created, provision the corresponding Google Drive folder structure using the Drive client module (unit-03), then store the folder ID mapping in PostgreSQL. Also implement team membership management (add/remove members, set roles).

## Discipline
backend - This unit will be executed by backend-focused agents.

## Domain Entities
- **Organization**: Created via API. Provisions a Drive root folder. Stores `drive_folder_id` in PostgreSQL.
- **Team**: Created within an org. Provisions a Drive subfolder inside the org's folder. Stores `drive_folder_id` in PostgreSQL.
- **Membership**: Created when a user is added to a team. Role: 'admin' or 'member'.

## Data Sources
- PostgreSQL (via Drizzle): CRUD for organizations, teams, memberships
- Google Drive API v3 (via Drive client module): Workspace folder provisioning

## Technical Specification

### API Routes
```
app/
  api/
    organizations/
      route.ts                # GET (list user's orgs), POST (create org)
      [orgId]/
        route.ts              # GET (org details), PATCH (update), DELETE
        teams/
          route.ts            # GET (list teams), POST (create team)
          [teamId]/
            route.ts          # GET (team details), PATCH, DELETE
            members/
              route.ts        # GET (list members), POST (add member)
              [memberId]/
                route.ts      # PATCH (change role), DELETE (remove)
```

### Create Organization Flow
1. Validate request (name, slug)
2. Ensure slug is unique
3. Insert org record in PostgreSQL (drive_folder_id = null initially)
4. Call `provisionWorkspace(token, orgName)` from Drive client module
5. Update org record with `drive_folder_id`
6. Create membership: creator → org's default team as admin
7. Return org with folder info

### Create Team Flow
1. Validate request (name, slug within org)
2. Verify user is admin of the org (has admin membership on any team in the org)
3. Get org's `drive_folder_id` from PostgreSQL
4. Insert team record (drive_folder_id = null initially)
5. Call `provisionWorkspace(token, teamName, orgDriveFolderId)` — creates subfolder
6. Update team record with `drive_folder_id`
7. Add creator as team admin
8. Return team with folder info

### Membership Management
- **Add member**: Lookup user by email, create membership record. If user doesn't exist yet, create a pending invitation (store email + team_id + role, resolve on first OAuth login).
- **Change role**: Update membership role (admin ↔ member). Require that there's always at least one admin.
- **Remove member**: Delete membership. Prevent removing the last admin.

### Authorization Pattern
Every API route:
1. Get session via Auth.js (`auth()`)
2. Extract user ID from session
3. For org routes: verify user has membership in any team within the org
4. For team routes: verify user has membership on the specific team
5. For admin-only operations (create team, manage members): verify admin role

### Shared Logic
```
src/
  lib/
    api/
      organizations.ts        # Org CRUD + provisioning logic
      teams.ts                # Team CRUD + provisioning logic
      members.ts              # Membership CRUD logic
      auth.ts                 # Route auth helpers (requireAuth, requireOrgAdmin, etc.)
```

## Success Criteria
- [ ] POST `/api/organizations` creates an org in PostgreSQL and provisions a Drive folder structure (root + memory/ + settings.yml), storing the folder ID
- [ ] POST `/api/organizations/:orgId/teams` creates a team with a Drive subfolder inside the org's Drive folder
- [ ] POST `/api/organizations/:orgId/teams/:teamId/members` adds a user to a team with a specified role
- [ ] All API routes validate that the authenticated user has the required access level (membership for reads, admin for writes)

## Risks
- **Partial failure**: If Drive provisioning fails after DB insert, we have an org without a folder. Mitigation: Set `drive_folder_id` to null initially, provision async, update on success. Dashboard shows "provisioning..." state. Can retry provisioning.
- **Invitation system**: Adding members by email who haven't signed up yet requires a pending state. Mitigation: Simple `invitations` table or a `pending_email` field on memberships. Resolve on first login.

## Boundaries
This unit does NOT handle: the Drive client implementation (unit-03 — already built), MCP server (unit-05), or dashboard UI (unit-06). It implements the server-side API and provisioning logic.

## Notes
- Use Next.js App Router API routes (`route.ts` with GET/POST/PATCH/DELETE exports)
- All routes require authentication — use a shared `requireAuth()` middleware
- Slugs: validate format (lowercase, hyphens, alphanumeric), check uniqueness per scope
- Consider adding a `created_by` field on orgs and teams to track the creator
- For invitations: a simple approach is to create membership records with a `status: 'pending' | 'active'` field, then flip to 'active' when the invited user first logs in
