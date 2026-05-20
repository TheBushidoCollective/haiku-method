# Installing H·AI·K·U in your harness

H·AI·K·U is an MCP-server-backed workflow engine. The MCP server is the core — every harness drives the same engine by registering it. The slash-command skills (`/haiku:haiku-start`, `/haiku:haiku-pickup`, …) are Claude-specific convenience; in every other harness you drive the workflow by calling the MCP tools directly (`haiku_run_next`, `haiku_intent_create`, …).

The portable launch command across every harness is:

```
npx -y haiku-method mcp
```

No global install required — `npx` resolves and runs the published `haiku-method` package on first use.

## Claude Code / Claude Cowork

```
/plugin marketplace add gigsmart/haiku-method
/plugin install haiku --scope project
```

The bundled marketplace ships the skills, the MCP server, and the studios. Nothing else to configure.

## Cursor

H·AI·K·U ships a Cursor plugin manifest (`.cursor-plugin/plugin.json`) that declares the MCP server and the skills. Install the plugin from the repo, or register the MCP server directly in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "haiku": { "command": "npx", "args": ["-y", "haiku-method", "mcp"] }
  }
}
```

## OpenAI Codex

H·AI·K·U ships a Codex plugin manifest (`.codex-plugin/plugin.json`). To register the MCP server directly, add to `~/.codex/config.toml`:

```toml
[mcp_servers.haiku]
command = "npx"
args = ["-y", "haiku-method", "mcp"]
```

Codex reads `AGENTS.md` for context. The repo's `AGENTS.md` explains how to drive the engine.

## Gemini CLI

Install as a Gemini extension (ships `gemini-extension.json` + `GEMINI.md`):

```
gemini extensions install https://github.com/gigsmart/haiku-method
```

The extension manifest registers the MCP server inline; `GEMINI.md` carries the context.

## OpenCode

H·AI·K·U ships an `opencode.json` MCP block. To register directly, add to your project `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "haiku": { "type": "local", "command": ["npx", "-y", "haiku-method", "mcp"], "enabled": true }
  }
}
```

OpenCode reads `AGENTS.md` (and falls back to `CLAUDE.md`) for context.

## GitHub Copilot CLI

Copilot CLI registers MCP servers in `~/.copilot/mcp-config.json` (or interactively via `/mcp add`):

```json
{
  "mcpServers": {
    "haiku": { "type": "local", "command": "npx", "args": ["-y", "haiku-method", "mcp"] }
  }
}
```

Copilot CLI reads `AGENTS.md` and `.github/copilot-instructions.md` for context. It has no custom slash-command surface, so drive the engine through the MCP tools.

## Any other MCP harness

If your harness speaks MCP, register a stdio server with command `npx` and args `["-y", "haiku-method", "mcp"]`. That's the whole integration — the engine handles the rest.
