---
title: >-
  Unit-04 scrubbing principles cross into implementation territory with specific
  vendor token prefixes
status: pending
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-05-05T23:16:51Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-05T23:16:51Z'
resolution: null
replies: []
---

## Mandate check

The completeness mandate requires rejecting any unit body that specifies implementation details — and the corollary is that inception units must describe the *problem space* at the principle level, not bind downstream stages to specific implementation shapes.

## What the artifact contains

`stages/inception/artifacts/privacy-and-data-handling-principles.md`, section `## Scrubbing principles`, under the `**API tokens and bearer credentials**` bullet, enumerates specific vendor token prefixes:

> e.g., `sk-...`, `ghp_...`, `glpat-...`, `AKIA...`

And under `**Slack, Stripe, and other service tokens**`:

> e.g., `xoxb-...` for Slack bot tokens, `sk_live_...` for Stripe secret keys, `SG.` prefixes for SendGrid

The artifact also specifies concrete URI DSN formats in the `**Passwords and connection strings**` bullet:

> `postgres://user:password@host/db`, `mysql://...`, `mongodb://...`

And under `**Private keys and certificates**`, specifies the exact PEM block header strings:

> `-----BEGIN PRIVATE KEY-----`, `-----BEGIN RSA PRIVATE KEY-----`, `-----BEGIN EC PRIVATE KEY-----`, `-----BEGIN CERTIFICATE-----`

## Why this is an out-of-scope incursion

These are scrubber implementation specifications, not privacy principles. The mandate requires inception to articulate **the data classes the scrubber must strip and why** — that is the problem-space articulation. Naming "API tokens and bearer credentials from well-known providers" as a class, with a principle-level detection signal description (e.g., "token-prefix pattern matching with entropy scoring"), is in scope.

Enumerating `ghp_...` (GitHub PAT prefix), `AKIA...` (AWS access key prefix), `xoxb-...` (Slack bot token prefix), specific DSN URI schemes, and PEM block headers is implementation specification. These belong in the development stage's scrubber design, not in inception principles. The design or development stage can and should consult the privacy principles to understand the *mandate* — but those stages should be the ones deciding which specific patterns to implement.

The spirit violation: by binding these prefixes at inception, the artifact constrains the scrubber design to known-at-inception credential formats. A scrubbing approach that uses entropy-based detection for unknown formats, or a deny-list maintained separately from the inception artifact, becomes harder to justify if the inception artifact already looks like a scrubber implementation guide.

## Specific location

`stages/inception/artifacts/privacy-and-data-handling-principles.md`, section `## Scrubbing principles`:

- `**API tokens and bearer credentials**` bullet — enumerates `sk-...`, `ghp_...`, `glpat-...`, `AKIA...` by prefix
- `**Passwords and connection strings**` bullet — enumerates `postgres://...`, `mysql://...`, `mongodb://...` DSN formats  
- `**Private keys and certificates**` bullet — enumerates PEM block header strings verbatim
- `**Slack, Stripe, and other service tokens**` bullet — enumerates `xoxb-...`, `sk_live_...`, `SG.` by prefix

## Required fix

Replace the specific prefixes, DSN formats, and PEM headers with principle-level descriptions of the detection signal family. For example:

- Instead of listing `ghp_...`, `sk-...`, `AKIA...`: "Strings matching the structural shape of known credential formats for well-known providers, identified by token-prefix conventions."
- Instead of listing `postgres://user:password@host/db`: "Connection strings in URI authority form where the authority section includes a password component."
- Instead of enumerating PEM headers: "PEM-encoded blocks delimited by `-----BEGIN ... KEY-----` / `-----END ... KEY-----` markers."

The enumeration of specific vendor prefixes belongs in the development-stage scrubber specification, not the inception privacy principles.
