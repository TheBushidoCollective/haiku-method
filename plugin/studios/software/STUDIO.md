---
name: application-development
slug: appdev
aliases: [software]
description: Lifecycle for web, mobile, and desktop applications
stages: [inception, design, product, development, operations, security]
fix_hats: [builder, reconciler, validator]
category: engineering
default_model: sonnet
---

# Application Development

Lifecycle for user-facing applications and services — web, mobile, desktop.

The mandatory core is the minimum a full feature needs: `inception` (research
and problem framing), `product` (behavioral spec + acceptance criteria), and
`development` (the code and tests that satisfy it). The remaining stages are
optional and dropped per intent when they don't apply — `design` for non-visual
work, `operations` when there's nothing to deploy or run, `security` for a
low-risk surface. The cursor offers a keep-or-drop decision the first time it
reaches each optional stage.

For games, use `gamedev`; for hardware, use `hwdev`.

Supports both single-stage (all disciplines merged) and multi-stage
(sequential discipline progression) execution modes.
