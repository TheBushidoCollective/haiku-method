---
status: pending
depends_on: [unit-01-project-scaffolding]
branch: ai-dlc/haiku-web-mcp/02-google-oauth
discipline: backend
workflow: ""
ticket: ""
---

# unit-02: Google OAuth & User Authentication

## Description
Set up Auth.js (NextAuth v5) with Google OAuth provider for the web dashboard. Handle sign-in/sign-up flow, create user records in PostgreSQL on first login, and configure session management. Request Google Drive API scopes so the OAuth token can be used for Drive operations in subsequent units.

## Discipline
backend - This unit will be executed by backend-focused agents.

## Domain Entities
- **User**: Created/updated on Google OAuth callback. Fields populated from Google profile (google_id, email, name, avatar_url).
- **Session**: Auth.js session stored as JWT (no server-side session store needed). Contains user ID and access token.

## Data Sources
- PostgreSQL (via Drizzle): User creation/lookup on OAuth callback
- Google OAuth 2.0: Authentication provider with Drive scopes

## Technical Specification

### Auth.js Configuration
```
src/
  auth.ts                     # Auth.js configuration (providers, callbacks, adapter)
  auth.config.ts              # Auth.js edge-compatible config (if needed)
app/
  api/auth/[...nextauth]/
    route.ts                  # Auth.js API route handler
  (auth)/
    login/page.tsx            # Login page with Google sign-in button
```

### Google OAuth Scopes
Request these scopes during OAuth:
- `openid` — standard OIDC
- `email` — user email
- `profile` — user name and avatar
- `https://www.googleapis.com/auth/drive.file` — access to app-created Drive files only

### Callbacks
1. **signIn callback**: On first login, create user record in PostgreSQL with `google_id`, `email`, `name`, `avatar_url`. On subsequent logins, update `name` and `avatar_url` if changed.
2. **jwt callback**: Include `access_token` in the JWT so it's available in the session. This token is used for Drive API calls in the dashboard (unit-03+). The token is only held in the encrypted JWT cookie — never persisted to the database.
3. **session callback**: Expose `user.id` (PostgreSQL UUID) and `accessToken` in the session object.

### Token Handling
- The Google OAuth `access_token` is included in the Auth.js JWT (encrypted cookie)
- It is NOT stored in PostgreSQL
- For the dashboard, Drive API calls use the token from the session
- For MCP (unit-05), Claude Code sends its own Bearer token per-request — completely independent of the dashboard session

### Environment Variables
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `NEXTAUTH_SECRET` — Auth.js encryption secret
- `NEXTAUTH_URL` — Canonical URL for auth callbacks (e.g., `https://haiku.railway.app`)

### Dependencies
- `next-auth@beta` (Auth.js v5 — Next.js App Router compatible)
- `@auth/drizzle-adapter` (if using Drizzle adapter, otherwise manual callback logic)

## Success Criteria
- [ ] Visiting `/login` shows a Google sign-in button; clicking it initiates the OAuth flow
- [ ] After successful Google authentication, user record is created in PostgreSQL with correct fields (google_id, email, name, avatar_url)
- [ ] Authenticated users are redirected to the dashboard; unauthenticated users are redirected to `/login`
- [ ] The session includes the user's PostgreSQL ID and Google access token (accessible server-side, not exposed to client)

## Risks
- **Token expiry**: Google access tokens expire after 1 hour. Mitigation: Auth.js supports token rotation — implement refresh token flow in the jwt callback. Request `access_type=offline` to get a refresh token.
- **Scope consent**: `drive.file` is a sensitive scope requiring Google OAuth consent screen configuration. Mitigation: Document the required Google Cloud Console setup in a README.

## Boundaries
This unit does NOT handle: Google Drive operations (unit-03), workspace provisioning (unit-04), MCP server auth (unit-05), or dashboard UI beyond the login page (unit-06). It only establishes the authentication pipeline.

## Notes
- Auth.js v5 uses the App Router pattern (`app/api/auth/[...nextauth]/route.ts`)
- The Drizzle adapter for Auth.js handles accounts/sessions tables — but since we're NOT persisting tokens, consider using custom callbacks instead of the full adapter
- Google Cloud Console setup: Create OAuth 2.0 credentials, add authorized redirect URIs, configure consent screen with `drive.file` scope
- For token refresh: store refresh_token in JWT on first sign-in (it's only provided once), use it to refresh access_token in jwt callback
