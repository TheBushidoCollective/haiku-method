---
workflow: default
git:
  change_strategy: intent
  auto_merge: true
  auto_squash: false
announcements: []
created: 2026-03-09
status: active
epic: ""
---

# HAIKU Web App + MCP Server

## Problem
HAIKU Method workspaces store memory (learnings, patterns, domain knowledge) as local files. Teams can't share memory across Claude Code sessions or machines. There's no centralized way to manage team structure (who belongs to which workspace) or persist memory in a shared backend. The existing `memory.mcp` config in settings.yml points to MCP servers, but no HAIKU-native MCP server exists to serve as the memory backend.

## Solution
Build a web application that serves two purposes:

1. **Dashboard** — A simple web UI for managing organizations, teams, and memberships. Authenticated via Google OAuth. Provisioning an org/team creates corresponding Google Drive folder structures that serve as HAIKU workspaces.

2. **MCP Server** — A remote MCP endpoint (Streamable HTTP transport) that Claude Code connects to. Authenticates via Google OAuth Bearer token (stored client-side by Claude Code). Acts as a thin authenticated proxy to Google Drive — translating MCP tool calls (memory_read, memory_write, etc.) into Drive API operations on the user's workspace folders.

The web app stores **minimal data in PostgreSQL** (user identity, org/team structure, Drive folder ID mappings). All workspace content (memory files, settings) lives in Google Drive. No OAuth tokens are persisted server-side — Claude Code stores tokens locally and passes them per-request.

## Domain Model

### Entities
- **User**: Google identity (email, name, avatar). Authenticated via Google OAuth. No tokens stored server-side.
- **Organization**: Top-level grouping. Has a name, slug, and Google Drive root folder ID. Maps to a HAIKU workspace root.
- **Team**: Belongs to an Organization. Has its own Drive folder (subfolder of org). Maps to a nested HAIKU workspace.
- **Membership**: User ↔ Team relationship with role (admin, member). Controls access to workspaces.
- **Workspace**: Virtual concept — an org or team's Google Drive folder structure containing memory/, settings.yml, and intents/.
- **Memory File**: A markdown document in a workspace's memory/ folder on Google Drive (organization.md, learnings.md, patterns.md, domain/*.md).

### Relationships
- Organization has many Teams
- Team has many Users (via Membership with role)
- User belongs to many Teams (via Membership)
- Organization has one root Workspace (Drive folder)
- Team has one Workspace (Drive subfolder of org)
- Workspace contains many Memory Files

### Data Sources
- **PostgreSQL**: Users, organizations, teams, memberships, Drive folder ID mappings. Minimal — identity and structure only.
- **Google Drive API v3** (scope: `drive.file`): Memory files, settings.yml, workspace folder structure. Source of truth for all workspace content.
- **Google OAuth 2.0**: Authentication + Drive access. Tokens stored client-side (Claude Code keychain or browser session).

### Data Gaps
- Google Drive folder ↔ HAIKU workspace mapping requires a registry in PostgreSQL (org/team → folder_id)
- Hierarchical memory resolution (team → org) requires walking the DB relationship then making multiple Drive reads
- No real-time sync — Drive files may be edited externally; treat as eventual consistency (always read-through)

## Success Criteria
- [ ] Web dashboard authenticates users via Google OAuth and displays org/team management UI
- [ ] Users can create organizations and teams, and manage team memberships (add/remove members, set roles)
- [ ] Creating an org/team provisions a corresponding Google Drive folder structure (workspace root, memory/ subfolder)
- [ ] MCP server endpoint (`/mcp`) accepts Streamable HTTP connections from Claude Code
- [ ] MCP server authenticates requests via Bearer token (Google OAuth token passed by Claude Code)
- [ ] `memory_read` tool returns the content of a memory file from the user's workspace on Google Drive
- [ ] `memory_write` tool creates or updates a memory file in the user's workspace on Google Drive
- [ ] `memory_list` tool returns all memory files in the user's workspace
- [ ] `settings_read` and `settings_write` tools read/write workspace settings.yml on Google Drive
- [ ] `workspace_info` tool returns workspace metadata (org, team, folder structure)
- [ ] All MCP tool calls validate that the authenticated user has access to the requested workspace (via team membership)
- [ ] PostgreSQL stores only identity data (users, orgs, teams, memberships) — no OAuth tokens persisted server-side
- [ ] Application deploys to Railway with PostgreSQL

## Context
- Tech stack: Next.js (App Router) + Express (MCP routes) + Drizzle ORM + PostgreSQL + Google OAuth (Auth.js) + `@modelcontextprotocol/sdk`
- The MCP server is stateless per-request — Bearer token extracted from each request, used for Drive API calls, never stored
- Google Drive scope `drive.file` limits access to app-created files only (safest scope)
- Claude Code handles OAuth flow: returns 401 → opens browser → stores token in local keychain → sends per-request
- Dashboard uses standard Auth.js session management (short-lived cookies)
- Deployment target: Railway (single service running custom Next.js server with Express MCP routes)
