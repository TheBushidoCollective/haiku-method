---
name: haiku-statusline
description: Install, remove, or preview the H·AI·K·U custom Claude Code status line — a one-line stage/phase indicator for the active intent
---

# Status Line

H·AI·K·U ships a custom Claude Code status line that shows, at a glance, where the active intent is in its lifecycle:

```
⬢ admin-portal-reimagine · ⬢⬢⬢⬣⬡⬡ development ❯ execute · 7/12 units
```

- `⬢` brand mark · then the intent slug
- the **stage pipeline**: `⬢` complete · `⬣` active (phase-hued) · `⬡` pending
- the active stage, a flow mark (`❯` running · `⊘` gated), and the **phase** (color-coded: execute=cyan, fix-loop=orange, review/approve=yellow, gate=magenta, elaborate=grey)
- a phase-appropriate **aggregate**: units done in execute, findings closed in fix-loop, units in review/approve/gate

When you're **not** on an active intent (no `.haiku/`, the intent is sealed, or you're outside a project), it transparently falls back to whatever status line you had before — it's purely additive.

## Install

Run the install command from the project (or pass `--global` to wire `~/.claude/settings.json`):

```bash
haiku statusline install
```

This points Claude Code's `statusLine` at `haiku statusline` and saves your existing status line as the fallback (in `.haiku/statusline-fallback.json`, or `~/.haiku/` for `--global`). The status line refreshes on the next prompt.

- Default (no flag): wires the **project** `.claude/settings.json`.
- `--global`: wires the user-level `~/.claude/settings.json` so the haiku line shows in every project (and falls back to your original line outside intents).

## Remove

```bash
haiku statusline uninstall
```

Restores the original status line you had before install (or removes the `statusLine` key entirely if you had none). Add `--global` if you installed globally.

## Preview

To see the line for the current project without installing, feed the status-line payload to the render command:

```bash
echo "{\"workspace\":{\"current_dir\":\"$PWD\"}}" | haiku statusline
```

Set `NO_COLOR=1` for a plain (no-ANSI) line; set `HAIKU_STATUSLINE_DEBUG=1` to print on stderr why it rendered nothing (no `.haiku/`, sealed intent, etc.).

## Guardrails

- The status-line command stays silent on any error — a status line that errored would spam the prompt — so if nothing appears, run the preview with `HAIKU_STATUSLINE_DEBUG=1` to see the reason.
- Install only edits the `statusLine` key; every other setting in `.claude/settings.json` is preserved.
- Outside an active intent the line falls through to whatever Claude Code would otherwise show. It reconstructs that by walking the settings files in Claude's own precedence order (project `.claude/settings.local.json` → project `.claude/settings.json` → `~/.claude/settings.json`) and, at whichever file haiku installed itself into, substituting the original line saved at install. So a status line you keep in a settings file haiku never touched (e.g. a project line when haiku is installed globally) still wins — the saved fallback record is only the last resort.
- The command Claude Code invokes depends on how the plugin is installed: a **production** (marketplace / npm) install writes `npx -y @haiku/haiku statusline` so it survives plugin updates with no path to rot; a **dev checkout** writes the absolute path to the bin dispatcher (npx can't resolve an unpublished local package). Claude Code runs the status-line command without the plugin bin on PATH, so neither form relies on PATH.
