# auth-proxy

Node 22 GCP Cloud Function (entry `authProxy`) live at `auth.haikumethod.ai`.
Brokers GitHub/GitLab OAuth so neither the browse site nor the CLI ever holds the
OAuth client secret. The secret lives only in Secret Manager and is read by this
function.

Two surfaces share one provider exchange (`src/providers.ts`):

| Surface | Endpoints |
| --- | --- |
| Browse site (Phase 1) | `POST /github/token`, `POST /gitlab/token` — code→token exchange |
| CLI device flow (Phase 2) | `POST /cli/start`, `POST /cli/complete`, `POST /cli/poll`, `POST /cli/refresh` |

Phase 2 (`src/cli.ts`, `src/sessions.ts`) is wired into the same `authProxy`
entry: `index.ts` calls `handleCliRoute(req, res)` first; it owns any `/cli/*`
path and falls through to the existing browse-site routes otherwise.

## CLI device flow

```
CLI                         auth-proxy                   browse site / provider
 |  POST /cli/start ----------->|                                  |
 |  <- { session_id,            | store PENDING (Firestore,        |
 |       verification_url }     |   keyed by session_id + state)   |
 |                              |                                  |
 |  (open verification_url) --------------------------------------> human approves
 |                              |        provider callback ----->  | /{provider}/callback
 |                              | <- POST /cli/complete            |   exchanges code→token
 |                              |    { state, access_token, ... }  |   then POSTs token here
 |                              | flip session -> READY            |
 |  POST /cli/poll ------------>|                                  |
 |  <- { status: ready,         | release ONCE, mark consumed      |
 |       access_token, ... }    |                                  |
```

### Endpoint contracts

**`POST /cli/start` `{ provider, host? }`** → `{ session_id, verification_url, expires_in }`.
Mints a 10-minute session + state, stores a PENDING record in Firestore keyed by
`session_id`, and returns the `verification_url` the human opens. The URL targets
the browse site's CLI authorize entry (`/oauth/cli/authorize`) carrying
`provider`, `host`, `state`, and `authorize_via` (the resolved provider authorize
endpoint). The browse site sends the human through the provider, and the existing
`/{provider}/callback` completes the exchange. Host-aware for enterprise GitHub /
self-managed GitLab.

**`POST /cli/complete` `{ state, access_token, refresh_token?, expires_at?, scopes?, account?, host? }`** → `{ status: "ready" }`.
**This is the single server endpoint the browse-site callback must POST to.** After
the existing `/{provider}/callback` exchanges the authorization code for a token,
it POSTs the captured token bundle here keyed by `state`. The session flips to
`ready`. `scopes` accepts a string (space/comma separated) or an array. An
enterprise `host` echoed here overrides the one captured at start.

> If the browse callback is purely client-side and cannot exchange the code
> server-side, it should instead POST the raw `code` to `/{provider}/token`
> (Phase 1) to get the bundle, then POST that bundle to `/cli/complete`.

**`POST /cli/poll` `{ session_id }`** →
- `{ status: "pending" }` while awaiting approval,
- `{ status: "ready", access_token, refresh_token?, expires_at?, scopes?, account, provider, host }` **exactly once**,
- `{ status: "consumed" }` / `{ status: "expired" }` thereafter.

The token is released a single time; the record is marked `consumed` and deleted
so it can never be replayed.

**`POST /cli/refresh` `{ provider, host?, refresh_token }`** → a fresh token bundle.
Re-runs the provider exchange with `grant_type=refresh_token` using the held
client secret. Persists nothing. Host-aware.

## Session store

Firestore collection `cli_sessions`. Every record carries `expires_at` (epoch
seconds). Reads opportunistically delete expired records; a Firestore TTL policy
on `expires_at` (see `deploy/terraform/modules/auth-proxy/firestore.tf`) is the
backstop sweep.

## Secrets / env

| Env var | Source |
| --- | --- |
| `HAIKU_GITHUB_OAUTH_CLIENT_ID` / `HAIKU_GITHUB_OAUTH_CLIENT_SECRET` | Secret Manager (Phase 1) |
| `HAIKU_GITLAB_OAUTH_CLIENT_ID` / `HAIKU_GITLAB_OAUTH_CLIENT_SECRET` | Secret Manager (Phase 1) |
| `HAIKU_<PROVIDER>_OAUTH_CLIENT_ID__<HOST>` / ... | optional per-enterprise-host overrides |
| `ALLOWED_ORIGIN` | CORS allowlist (Phase 1); first entry is the default browse origin |
| `BROWSE_ORIGIN` | optional override for the `verification_url` origin |

## Develop / test

```sh
npm install
npm test       # tsc -> dist/ then node --test test/
```

Tests inject an in-memory session store and a fake `fetch`
(`setSessionStore`, `setFetchImpl`), so no GCP credentials or network are needed.
