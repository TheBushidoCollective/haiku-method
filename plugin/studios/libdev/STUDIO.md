---
name: library-development
slug: libdev
description: Lifecycle for libraries, SDKs, and CLI tools
stages: [inception, development, security, release]
category: engineering
default_model: sonnet
deprecated: true
---

> **Deprecated 2026-05-27.** Library / SDK / CLI work folded into the `software`
> (appdev) studio, which now carries an optional `release` stage and drops
> `design` / `product` / `operations` for non-application intents. This studio is
> hidden from new-intent pickers but stays resolvable so in-flight `studio:
> libdev` intents finish unchanged. Do not delete.

# Library Development

Lifecycle for libraries, SDKs, and CLI tools. Differs from application
development: no product or design phases — inception directly covers discovery
and API surface (semver policy, public contract, extension points), development
builds against that contract, and release publishes rather than deploys.
