---
name: memory
description: Organizational memory provider — where learnings, patterns, and domain knowledge are stored and retrieved
category: memory
---

# Memory Provider

The memory provider determines where HAIKU stores and retrieves organizational knowledge that persists across intents.

## Where Memory Lives

Memory lives in the workspace's `memory/` directory. Since the workspace is configurable and can be nested hierarchically, memory inherits upward through the workspace tree:

```
company-workspace/
  memory/                    # Company-wide knowledge
    learnings.md
    patterns.md
    domain/
      brand-voice.md
  engineering/               # Nested workspace
    memory/                  # Engineering-specific knowledge
      patterns.md
    intents/                 # Engineering intents
  marketing/                 # Nested workspace
    memory/                  # Marketing-specific knowledge
    intents/
```

When working in `engineering/`, memory resolution yields:
1. `engineering/memory/` (most specific)
2. `company-workspace/memory/` (inherited from parent)

## Supported Backends

### Filesystem (default)

No configuration required. Memory is stored in `{workspace}/memory/`.

Works with:
- Local directories
- Mounted cloud drives (Google Drive, Dropbox, OneDrive)
- Symlinks to shared locations
- Network-mounted filesystems

### Notion

Set `memory.mcp: notion` in `{workspace}/settings.yml`.

The elaborate and reflect skills will use the Notion MCP server to:
- **Read**: Search for pages in a configured database/workspace for prior learnings
- **Write**: Create or append to pages with learnings from reflection

Requires the Notion MCP server to be connected in Claude.

### Google Drive

Set `memory.mcp: google-drive` in `{workspace}/settings.yml`.

Uses the Google Drive MCP server to read/write memory documents in a configured folder.

## How Memory Is Used

| Phase | Read | Write |
|-------|------|-------|
| **Elaboration** | Prior learnings inform decomposition and criteria | Organizational context bootstrapped on first run (organization.md) |
| **Execution** | Patterns inform approach selection | Scratchpad captures per-iteration learnings |
| **Operation** | Operational patterns guide responses | Operational insights recorded |
| **Reflection** | All prior memory provides analysis context | Learnings, patterns, and anti-patterns saved |

## Memory Structure

```
{workspace}/memory/
  organization.md   # Organizational context — team, tools, conventions (bootstrapped on first elaboration)
  learnings.md      # Accumulated learnings from reflection phases
  patterns.md       # Established patterns and anti-patterns
  domain/           # Domain models and vocabulary
    {domain}.md
```

`organization.md` is bootstrapped during the first elaboration in a workspace (Phase 1.75: Organizational Discovery). It captures the team, tech stack, conventions, and domain vocabulary — everything needed for HAIKU to produce contextually appropriate output from the first interaction.

Each file is plain markdown that accumulates over time. New entries are appended with a date header.

## Hierarchical Inheritance

Memory resolution walks up the workspace tree. A child workspace inherits all memory from its ancestors, with more-specific memory taking contextual precedence. This means:

- **Company-level** learnings (e.g., "always involve legal for external work") apply everywhere
- **Team-level** patterns (e.g., "prefer integration tests") apply only within that team's workspace
- **Siblings don't inherit** from each other — marketing memory is not visible to engineering
