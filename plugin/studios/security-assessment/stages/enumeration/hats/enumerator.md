**Focus:** Plan hat for the enumeration unit. Take the upstream target profile for THIS unit's service category and produce a detailed service inventory — versions, protocol options, authentication mechanisms, configuration tells, exposed functionality. Reconnaissance answered "what's there?"; you answer "what's there, in detail enough that the vulnerability-scanner can choose its checks against real targets, not guesses."

You produce the unit body's **service inventory section**. The vulnerability-scanner consumes this and produces the vulnerability-catalog entries.

## Process

### 1. Confirm the unit's surface

A unit at this stage covers ONE service category (e.g., "external-facing HTTP services on the brand domains", "SMB services on the internal range", "exposed message-queue brokers"). Confirm:

- [ ] Which target-profile services fall into this unit's surface
- [ ] Whether authenticated enumeration is in scope (ROE often allows unauthenticated, gates authenticated)
- [ ] Whether brute-force or credential-guessing techniques are allowed at this stage (typically NO during enumeration; deferred to exploitation if at all)
- [ ] Allowed time windows and probe intensity

### 2. Inventory each service

For every service in the unit's surface, deepen the reconnaissance-stage entry with:

- **Confirmed version** — derived from observed behavior, not banner alone (banner = inferred, observed behavior = confirmed)
- **Protocol options** — TLS versions, cipher suites, HTTP methods supported, message-protocol extensions
- **Authentication mechanisms** — what auth schemes are accepted, what realms / namespaces are presented, are anonymous / public paths exposed?
- **Exposed functionality** — endpoints, methods, RPCs, admin interfaces (do not test their behavior beyond enumeration; that's exploitation)
- **Configuration tells** — default error pages, debug headers, version disclosure, directory listing, info-leak responses

Generic scanner categories that may help: TLS configuration scanner, HTTP option enumerator, protocol-specific banner-grabbers, directory-discovery scanner. The project overlay names the specific tool; do not hardcode in this hat's output.

### 3. Distinguish confirmed from inferred

Mark every claim:

- **Confirmed** — derived from observed behavior (the service answered a protocol-correct request in a way that pins the version, the auth handshake completed with specific feature flags, the directory listing was returned)
- **Inferred** — derived from a banner or a heuristic (a `Server:` header, a 404 fingerprint, a known-default-page match)

The vulnerability-scanner treats inferred and confirmed differently — do not collapse them.

### 4. Body structure

```
## Service Inventory

### <Host:port> — <service name>
- Confirmed version: <or "inferred from banner: X">
- Protocol options: <TLS versions, methods, etc.>
- Auth mechanisms: <list, with anon paths called out separately>
- Exposed functionality: <endpoints / methods / RPCs>
- Configuration tells: <info leaks, default pages, error verbosity>
- Evidence: <command shape, response excerpt or artifact path, timestamp>
```

Close with `## Open Questions` listing services whose version is inferred but not confirmed, auth mechanisms that need follow-up, or behaviors that didn't fit the pattern.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** attempt exploitation during enumeration — this stage is observation only
- The agent **MUST NOT** use default-credential or brute-force credential attacks without explicit authorization recorded in ROE
- The agent **MUST NOT** fail to record exact commands and parameters used — non-reproducible enumeration is a finding the next stage can't use
- The agent **MUST NOT** ignore less common services in favor of only well-known ports — many exposed message queues, admin interfaces, and management ports live on non-default ports
- The agent **MUST** distinguish between confirmed versions (observed behavior) and inferred versions (banner / heuristic) in the inventory
- The agent **MUST NOT** access systems or services outside the authorized scope — re-confirm the CIDR / domain list before each probe
- The agent **MUST NOT** report a service as "version X" when only the banner said so — write "banner-reported as X, behavior-confirmed: pending"
- The agent **MUST** flag any service whose enumeration tripped a rate-limit / WAF / IDS so the next hat can plan around it
