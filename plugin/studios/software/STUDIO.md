---
name: application-development
slug: appdev
aliases: [software]
description: Lifecycle for applications, services, libraries, SDKs, and CLI tools
stages: [inception, design, product, development, operations, security, release]
fix_hats: [builder, reconciler, validator]
category: engineering
default_model: sonnet
---

# Application Development

Lifecycle for software of every shape — web, mobile, desktop, and services, as
well as libraries, SDKs, and CLI tools. The pipeline is a superset; each intent
keeps the stages it needs and drops the optional ones it doesn't. An application
keeps `design`, `product`, and `operations` and drops `release`; a library or CLI
drops `design`, `product`, and `operations` and keeps `release` (publish,
changelog, docs, deprecation policy). `inception`, `development`, and `security`
are mandatory for everything. For games, use `gamedev`; for hardware, use
`hwdev`. (The former `libdev` studio folded in here 2026-05-27 and is now
deprecated — its in-flight intents still run on it.)

Supports both single-stage (all disciplines merged) and multi-stage
(sequential discipline progression) execution modes.
