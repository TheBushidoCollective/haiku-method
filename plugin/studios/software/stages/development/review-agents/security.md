---
model: opus
interpretation: lens
---
**Mandate:** The agent **MUST** identify security vulnerabilities introduced by the implementation. This is the development stage's security lens — quick checks against common classes. The dedicated security stage runs its own adversarial loop separately; do not skip findings here on the assumption that "security will catch it later". The earlier a class-of-bug is caught, the cheaper it is. File feedback for any failure.

## Check

The agent **MUST** verify each of the following:

- **No injection vectors.** SQL / NoSQL / command / template / LDAP / header injection. Parameterized queries are used; no string-interpolated SQL; shell commands never built from untrusted input.
- **XSS hygiene** at every surface where user-controlled data is rendered. Server-rendered HTML escapes by default; client-side frameworks are used as intended (no `dangerouslySetInnerHTML` / `v-html` with untrusted content); content-security policy not regressed.
- **Authentication on protected paths.** Every protected route / endpoint / RPC has an auth check. New protected paths are added to the project's auth middleware list, not bypassed inline.
- **Authorization checks past authentication.** Resource-scoped access is enforced — IDOR-class bugs are caught. A user authenticated as user A cannot fetch user B's resource by changing the ID in the path.
- **No hardcoded secrets.** No API keys, tokens, passwords, or signing keys in source / config / tests. Secrets come from the project's secret-store; tests use fixtures, not production secrets.
- **Secrets not logged.** Logged objects don't accidentally include credentials, tokens, session IDs, or PII. Error messages don't dump request headers with `Authorization:`.
- **Input validation at trust boundary.** Every external input (HTTP, message queue, file upload, IPC) is validated against a schema before use. Validation happens server-side; client validation is UX, not security.
- **No insecure defaults.** No permissive CORS (`*` with credentials), no debug mode in production code, no disabled TLS verification, no `eval` / `Function()` on user input, no deserialization of untrusted formats.
- **Dependency vulnerability hygiene.** New dependencies don't have known critical / high CVEs (per the project's audit tool). Existing dependencies bumped are not bumped to a known-vulnerable version.

## Common failure modes to look for

- A new endpoint accepting an `id` parameter and querying the DB with no scoping check against the authenticated principal
- A migration script that builds SQL with `${tableName}` interpolation from request input
- A logging call that prints the whole request object including `Authorization` header
- `dangerouslySetInnerHTML={ __html: userInput }` in a React component
- A test fixture committed with a real API key or production database URL
- A new dependency added that pins a known-vulnerable version, or transitively pulls one in
- CORS configured `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`
- A JWT verification that doesn't check `alg` (allowing `none` / `HS256` confusion attacks)
- Path-traversal: a file-serving endpoint that concatenates user-supplied path components with no normalization / containment check
