---
status: completed
depends_on: []
branch: ai-dlc/haiku-web-mcp/01-project-scaffolding
discipline: backend
workflow: ""
ticket: ""
---

# unit-01: Project Scaffolding & Database Schema

## Description
Initialize the Next.js project with TypeScript, configure Drizzle ORM with PostgreSQL, define the database schema, and set up the Railway deployment configuration. This is the foundation every other unit builds on.

## Discipline
backend - This unit will be executed by backend-focused agents.

## Domain Entities
- **User**: `id` (uuid, PK), `google_id` (string, unique), `email` (string, unique), `name` (string), `avatar_url` (string, nullable), `created_at` (timestamp), `updated_at` (timestamp)
- **Organization**: `id` (uuid, PK), `name` (string), `slug` (string, unique), `drive_folder_id` (string, nullable), `created_by` (uuid, FK → users), `created_at` (timestamp), `updated_at` (timestamp)
- **Team**: `id` (uuid, PK), `org_id` (uuid, FK → organizations), `name` (string), `slug` (string, unique within org), `drive_folder_id` (string, nullable), `created_by` (uuid, FK → users), `created_at` (timestamp), `updated_at` (timestamp)
- **Membership**: `id` (uuid, PK), `user_id` (uuid, FK → users), `team_id` (uuid, FK → teams), `role` (enum: 'admin' | 'member'), `created_at` (timestamp). Unique constraint on (user_id, team_id).

## Data Sources
- PostgreSQL (via Drizzle ORM): Schema definition and migrations

## Technical Specification

### Project Structure
```
app/                          # Next.js App Router (created by create-next-app)
  (dashboard)/                # Dashboard route group (future unit-06)
  api/                        # API routes
src/
  db/
    schema.ts                 # Drizzle schema definitions
    index.ts                  # Database connection + Drizzle client
    migrations/               # Generated migration files
  lib/
    env.ts                    # Environment variable validation
server.ts                     # Custom Express server wrapping Next.js (for MCP routes)
drizzle.config.ts             # Drizzle Kit configuration
Dockerfile                    # Railway deployment
railway.json                  # Railway service config
```

### Custom Server
The project needs a custom Express server (`server.ts`) that:
1. Creates an Express app
2. Mounts the MCP endpoint at `/mcp` (future unit-04)
3. Delegates all other routes to Next.js request handler
4. Listens on `PORT` environment variable (Railway sets this)

This is needed because the MCP SDK integrates with Express, not Next.js API routes.

### Database Connection
- Use `DATABASE_URL` environment variable (Railway provides this)
- Drizzle with `drizzle-orm/node-postgres` driver
- Connection pooling via `pg` Pool

### Dependencies
- `next`, `react`, `react-dom` (Next.js)
- `express`, `@types/express` (custom server for MCP)
- `drizzle-orm`, `drizzle-kit` (ORM + migrations)
- `pg`, `@types/pg` (PostgreSQL driver)
- `zod` (env validation, shared with MCP tools later)
- `typescript`, `@types/node`, `@types/react`

## Success Criteria
- [ ] Next.js project initializes and serves a page at `/` with the custom Express server
- [ ] Drizzle schema defines users, organizations, teams, and memberships tables with all fields and constraints listed above
- [ ] `drizzle-kit push` or `drizzle-kit migrate` successfully creates all tables in PostgreSQL
- [ ] Dockerfile builds and runs the application (verifiable with `docker build`)

## Risks
- **Custom server complexity**: Next.js custom servers lose some optimizations. Mitigation: Only use custom server for MCP route; all dashboard routes go through standard Next.js.
- **Drizzle migration strategy**: Push vs. migrate. Mitigation: Start with `push` for development, add `migrate` for production later.

## Boundaries
This unit does NOT handle: authentication (unit-02), Google Drive integration (unit-03, unit-04), MCP server setup (unit-05), or dashboard UI (unit-06). It only sets up the project skeleton and database schema.

## Notes
- Use `drizzle-orm/pg-core` for schema definitions
- UUID primary keys via `uuid().defaultRandom().primaryKey()`
- The custom server pattern: `const app = express(); const nextApp = next({ dev }); app.all('*', nextApp.getRequestHandler()); app.listen(PORT)`
- Railway auto-detects Dockerfile — no special config needed beyond `railway.json` for service settings
