#!/bin/bash
# workspace.sh - HAIKU Workspace Resolution
#
# Resolves the workspace path where HAIKU artifacts live.
# The workspace is a standalone knowledge base — not tied to any project.
#
# Resolution order (highest priority first):
#   1. HAIKU_WORKSPACE environment variable
#   2. .haiku.yml file in project root (workspace: field)
#
# If neither is set, resolve_workspace exits with an error.
#
# Usage:
#   source workspace.sh
#   ws=$(resolve_workspace)
#   intent_dir=$(workspace_intent_dir "my-intent")

WORKSPACE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! type _yaml_get_simple &>/dev/null; then
  # shellcheck source=dag.sh
  source "$WORKSPACE_SCRIPT_DIR/dag.sh"
fi

# Resolve the workspace root path
# Usage: resolve_workspace
resolve_workspace() {
  # 1. Environment variable (highest priority)
  if [ -n "${HAIKU_WORKSPACE:-}" ]; then
    echo "$HAIKU_WORKSPACE"
    return
  fi

  # 2. .haiku.yml in project root
  local search_dir="${1:-.}"
  local current
  current=$(cd "$search_dir" && pwd)
  while [ "$current" != "/" ]; do
    if [ -f "$current/.haiku.yml" ]; then
      local configured
      configured=$(_yaml_get_simple "workspace" "" < "$current/.haiku.yml")
      if [ -n "$configured" ]; then
        # Expand ~ to home directory
        configured="${configured/#\~/$HOME}"
        echo "$configured"
        return
      fi
    fi
    current=$(dirname "$current")
  done

  # No workspace configured
  echo "Error: No HAIKU workspace configured. Set HAIKU_WORKSPACE or create .haiku.yml with a workspace: field." >&2
  return 1
}

# Get the intents directory within the workspace
# Usage: workspace_intents_dir
workspace_intents_dir() {
  echo "$(resolve_workspace)/intents"
}

# Get a specific intent's directory
# Usage: workspace_intent_dir <intent-slug>
workspace_intent_dir() {
  local slug="$1"
  echo "$(resolve_workspace)/intents/$slug"
}

# Get the settings file path
# Usage: workspace_settings_file
workspace_settings_file() {
  echo "$(resolve_workspace)/settings.yml"
}

# Get the workspace hats directory (for custom hat overrides)
# Usage: workspace_hats_dir
workspace_hats_dir() {
  echo "$(resolve_workspace)/hats"
}

# Get the workspace workflows file
# Usage: workspace_workflows_file
workspace_workflows_file() {
  echo "$(resolve_workspace)/workflows.yml"
}

# Resolve memory directories with upward inheritance
# Walks up the workspace tree, collecting memory/ dirs from each level.
# Returns paths from most-specific (current) to least-specific (root).
# Usage: resolve_memory_dirs
resolve_memory_dirs() {
  local workspace
  workspace=$(resolve_workspace)

  # Normalize to absolute path
  if [[ "$workspace" != /* ]]; then
    workspace="$(cd "$workspace" 2>/dev/null && pwd)" || return
  fi

  local current="$workspace"
  while true; do
    if [ -d "$current/memory" ]; then
      echo "$current/memory"
    fi
    local parent
    parent=$(dirname "$current")
    # Stop if we've hit the filesystem root or the parent has no memory
    if [ "$parent" = "$current" ]; then
      break
    fi
    # Stop walking up if parent doesn't have a memory/ dir
    # (we've left the workspace hierarchy)
    if [ ! -d "$parent/memory" ]; then
      break
    fi
    current="$parent"
  done
}

# Find a hat definition file (workspace override > plugin default)
# Usage: resolve_hat_file <hat-name>
resolve_hat_file() {
  local hat="$1"
  local ws_hats
  ws_hats=$(workspace_hats_dir)

  if [ -f "$ws_hats/${hat}.md" ]; then
    echo "$ws_hats/${hat}.md"
  elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/hats/${hat}.md" ]; then
    echo "${CLAUDE_PLUGIN_ROOT}/hats/${hat}.md"
  fi
}
