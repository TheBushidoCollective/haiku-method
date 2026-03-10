---
status: pending
depends_on: [unit-02-google-oauth, unit-04-workspace-provisioning]
branch: ai-dlc/haiku-web-mcp/06-dashboard-ui
discipline: frontend
workflow: ""
ticket: ""
---

# unit-06: Dashboard UI — Org & Team Management

## Description
Build the web dashboard UI for managing organizations, teams, and memberships. Simple, functional interface — not a design showcase. Users should be able to create orgs, create teams within orgs, add/remove team members, and view workspace status (Drive folder provisioned, memory files present).

## Discipline
frontend - This unit will be executed by frontend-focused agents.

## Domain Entities
- **Organization**: Displayed as cards/rows. Shows name, slug, team count, created date.
- **Team**: Displayed within an org context. Shows name, member count, workspace status (Drive folder provisioned or not).
- **Membership**: Displayed as member list within a team. Shows user name, email, role, with actions to change role or remove.
- **User**: Current user's profile shown in nav. Other users shown in member lists.

## Data Sources
- Next.js API routes (unit-04): All CRUD operations for orgs, teams, members
- Auth.js session: Current user identity and auth state

## Technical Specification

### Page Structure
```
app/
  (dashboard)/
    layout.tsx                 # Dashboard shell — nav bar with user avatar, sidebar with org list
    page.tsx                   # Dashboard home — list of user's orgs, "Create org" button
    orgs/
      new/page.tsx             # Create organization form
      [orgSlug]/
        page.tsx               # Org overview — team list, org settings
        teams/
          new/page.tsx         # Create team form
          [teamSlug]/
            page.tsx           # Team detail — member list, workspace status
            members/
              page.tsx         # Member management — add member, change roles
  (auth)/
    login/page.tsx             # Login page (from unit-02)
```

### Dashboard Layout
- **Top nav**: HAIKU logo/wordmark, current user avatar + name, sign out button
- **Main content**: Full-width, responsive. No sidebar needed for MVP.

### Dashboard Home (`/`)
- List of organizations the user belongs to
- Each org shows: name, number of teams, user's role
- "Create Organization" button (prominent)
- Empty state: "You don't belong to any organizations yet. Create one to get started."

### Organization Page (`/orgs/[orgSlug]`)
- Org name as heading
- Section: Teams — list of teams with name, member count, workspace status badge (green = provisioned, yellow = pending)
- "Create Team" button
- Section: Settings — org slug (read-only), Drive folder status
- Only admins see settings and "Create Team" button

### Team Page (`/orgs/[orgSlug]/teams/[teamSlug]`)
- Team name as heading, breadcrumb back to org
- Section: Members — table with name, email, role, actions (change role, remove)
- "Add Member" button → modal or inline form (email input + role selector)
- Section: Workspace Status — Drive folder provisioned?, memory files list (names only), settings.yml present?
- Section: Connect to Claude Code — shows the `claude mcp add` command:
  ```
  claude mcp add --transport http haiku https://haiku.railway.app/mcp
  ```

### Create Org Form (`/orgs/new`)
- Fields: Name (text), Slug (auto-generated from name, editable)
- Submit → POST `/api/organizations` → redirect to org page
- Validation: name required, slug format (lowercase, hyphens, alphanumeric)

### Create Team Form (`/orgs/[orgSlug]/teams/new`)
- Fields: Name, Slug (auto-generated)
- Submit → POST `/api/organizations/:orgId/teams` → redirect to team page

### Styling
- Use Tailwind CSS (included with Next.js)
- Simple, clean design. No component library needed.
- Responsive but desktop-first (this is a dev tool dashboard)
- Color palette: neutral grays, one accent color for primary actions

### Client-Side Data Fetching
- Use React Server Components for initial page loads
- Use `fetch` with Next.js `revalidatePath` for mutations
- No client-side state management library needed (simple enough for RSC + server actions)

## Success Criteria
- [ ] Dashboard home page lists all organizations the user belongs to with "Create Organization" button
- [ ] Users can create organizations and teams through the web UI, which provisions Drive folder structures
- [ ] Team detail page shows member list with ability to add members (by email) and change roles (admin/member)
- [ ] Team page displays workspace status (provisioned/pending) and shows the `claude mcp add` command for connecting Claude Code

## Risks
- **Server Component limitations**: Some interactions (modals, inline forms) require client components. Mitigation: Use client components sparingly for interactive elements, RSC for everything else.
- **Drive provisioning feedback**: Creating an org/team triggers async Drive provisioning. Mitigation: Show "Provisioning..." state, poll or use streaming to update when complete.

## Boundaries
This unit does NOT handle: authentication flow beyond using the session (unit-02), Drive client operations (unit-03), API route implementation (unit-04), or MCP server (unit-05). It only implements the React UI that calls existing API routes.

## Notes
- Keep it simple — this is an MVP dashboard, not a polished product
- Use Next.js App Router patterns: Server Components by default, `"use client"` only when needed
- Server Actions can replace API route calls for form submissions (optional — API routes already exist from unit-04)
- No tests required for MVP frontend — focus on functionality
- Consider adding a "Copy command" button next to the `claude mcp add` command for easy clipboard copy
