---
name: version
description: Show the running H·AI·K·U MCP binary version, plugin version, and whether the engine is the dev source build or the compiled bundle
---

# Version

Call the `haiku_version_info` tool to retrieve version information.

Display:
- **MCP version** — the version baked into the running binary at build time (or `dev` when the binary wasn't built)
- **Plugin version** — the version from `plugin.json` on disk
- **Build kind** — whether the running engine is the compiled production bundle (`plugin/bin/haiku.mjs`) or a dev process loading TypeScript directly via bun/tsx. The two can disagree with the plugin version if the dev tree has uncommitted or unbuilt changes
- **Runtime** — `node <version>` (or `bun <version>` etc.) — useful when triaging "why does my behavior differ from the docs"
- **Entry** — the actual file the runtime launched with (`process.argv[1]`). For prod this points at the bundle; for dev it points at the source file

If a pending update is reported, mention it to the user.

When `build_kind` is `dev`, also call out that any working-tree edits to `packages/haiku/src/**` are live — no rebuild needed. For `prod`, a rebuild (`bun run --cwd packages/haiku build`) is required for source edits to take effect.
