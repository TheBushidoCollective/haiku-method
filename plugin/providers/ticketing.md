---
provider_kind: ticketing
category: workflow
always_on: false
splices_into:
  - elaborate
  - execute
  - complete_stage
  - seal_intent
description: Ticketing workflow provider — bidirectional sync between H·AI·K·U units/intents and external issue trackers.
---

# Ticketing Provider — Behavior Contract

A ticketing provider is configured (Jira, Linear, GitHub Issues, GitLab Issues, …) when `providers.ticketing.*` is set in `.haiku/settings.yml`. This contract applies any time you're operating on an intent in such a project.

## Mode

Capability is gated on which MCP tools you actually have available:

- **Full operational control** — you have create/update/transition tools for the configured tracker. Create tickets from units, transition status as the unit moves, close on completion.
- **Read-only-with-references fallback** — you have read access (or no MCP tool at all). Don't try to call write APIs. Just record `external_refs:` so the link is auditable and a human (or a future session with the tools) can sync.

Detect at use time by checking your available tool surface. Don't fail loudly when tools are missing — degrade silently to the fallback.

## What you, the agent, must do

### At intent creation
- If the user references an existing epic / parent issue, record it as `external_refs.ticket_epic` on `intent.md` frontmatter.
- If no epic exists and you have create tools, create one and stamp `external_refs.ticket_epic` with the new key.
- Without create tools, leave the field empty and tell the user "tracked locally; link an epic later via `haiku_intent_set`."

### At decompose (drafting units)
- Every unit you draft gets `external_refs:` (omit when no provider is configured, but populate when one is).
- If you have create tools: create a ticket per unit, link it to the intent's epic, record the key as `external_refs.ticket: <KEY>`.
- Map unit `depends_on` to ticket blocked-by links when the provider supports it.
- Without create tools: leave `external_refs.ticket` empty; the user fills in retroactively.

### At unit advance (status sync)
- When the unit transitions from `pending` → `active` (first hat starts), move the ticket to **In Progress** (if you have the transition tool).
- When the unit passes its final hat, move the ticket to **Done**.
- When a unit is rejected (hat returns rework), add the reject reason as a ticket comment and keep the ticket In Progress.

### At stage / intent completion
- Post a stage-summary comment to the epic when a stage closes (one comment per stage, listing units that landed).
- At intent_complete, transition the epic to **Done** and post the closing summary.

## What NOT to do

- Don't push raw H·AI·K·U frontmatter to the tracker. Translate: unit body prose → ticket description; unit `quality_gates:` → ticket checklist; unit `depends_on:` → linked tickets.
- Don't create top-level provider keys in settings (e.g. no top-level `jira:` block). All config lives under `providers.ticketing.config`.
- Don't fabricate ticket keys. If you can't reach the tracker, leave `external_refs.ticket` empty and surface a one-line note in your response.

## Translation map

| H·AI·K·U concept | Ticket concept |
|---|---|
| Intent | Epic / Parent issue |
| Unit | Child issue / sub-task |
| `depends_on:` | Blocked-by link |
| Stage | (optional) Sprint / iteration assignment |
| Review finding | Comment on the unit's ticket |
| Stage close | Comment on the epic |
| Intent close | Epic transition to Done |
