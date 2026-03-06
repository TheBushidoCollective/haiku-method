#!/bin/bash
# config.sh - HAIKU Configuration System
#
# Provides configuration loading with precedence:
# 1. Intent frontmatter (highest priority)
# 2. Workspace settings ({workspace}/settings.yml)
# 3. Built-in defaults (lowest priority)
#
# Usage:
#   source config.sh
#   config=$(get_haiku_config "$intent_dir")

# Source workspace resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! type resolve_workspace &>/dev/null; then
  # shellcheck source=workspace.sh
  source "$SCRIPT_DIR/workspace.sh"
fi
# shellcheck source=storage.sh
source "$SCRIPT_DIR/storage.sh"

# Default configuration values
HAIKU_DEFAULT_WORKFLOW="default"

# Source dag.sh for _yaml_get_simple if not already loaded
if ! type _yaml_get_simple &>/dev/null; then
  DAG_LIB="$SCRIPT_DIR/dag.sh"
  if [ -f "$DAG_LIB" ]; then
    # shellcheck source=dag.sh
    source "$DAG_LIB"
  fi
fi

# Load a single setting from workspace settings.yml
# Usage: load_haiku_setting <key> [default]
load_haiku_setting() {
  local key="$1"
  local default="${2:-}"
  local settings_file
  settings_file=$(workspace_settings_file)

  if [ ! -f "$settings_file" ]; then
    echo "$default"
    return
  fi

  _yaml_get_simple "$key" "$default" < "$settings_file"
}

# Load quality gates from workspace settings
# Usage: load_gates
# Returns: JSON array of gate configurations
load_gates() {
  local workspace
  workspace=$(resolve_workspace)
  local gates_file="$workspace/gates.json"

  if [ -f "$gates_file" ] && command -v jq &>/dev/null; then
    jq -c '.' "$gates_file" 2>/dev/null || echo "[]"
    return
  fi

  echo "[]"
}

# Get enabled gates for a specific event
# Usage: get_event_gates <event>
# Returns: JSON array of matching gate configs
get_event_gates() {
  local event="$1"
  local gates
  gates=$(load_gates)

  echo "$gates" | jq -c "[.[] | select(.enabled != false and (.event // \"Stop\") == \"$event\")]" 2>/dev/null || echo "[]"
}

# Run command-type quality gates for an event
# Usage: run_gates <event>
# Returns: 0 if all pass, 1 if any fail
run_gates() {
  local event="$1"
  local gates
  gates=$(get_event_gates "$event")

  local count
  count=$(echo "$gates" | jq 'length' 2>/dev/null || echo "0")

  if [ "$count" -eq 0 ]; then
    return 0
  fi

  local i=0
  while [ "$i" -lt "$count" ]; do
    local gate
    gate=$(echo "$gates" | jq -c ".[$i]")
    local gate_type
    gate_type=$(echo "$gate" | jq -r '.type // "command"')
    local gate_name
    gate_name=$(echo "$gate" | jq -r '.name')

    if [ "$gate_type" = "command" ]; then
      local cmd
      cmd=$(echo "$gate" | jq -r '.command // ""')
      if [ -n "$cmd" ]; then
        echo "Running gate: $gate_name" >&2
        if ! eval "$cmd" >/dev/null 2>&1; then
          echo "Gate FAILED: $gate_name" >&2
          return 1
        fi
        echo "Gate PASSED: $gate_name" >&2
      fi
    fi

    i=$((i + 1))
  done

  return 0
}

# Get merged HAIKU configuration
# Usage: get_haiku_config [intent_dir]
# Returns: JSON object
get_haiku_config() {
  local intent_dir="${1:-}"

  local workflow="$HAIKU_DEFAULT_WORKFLOW"

  # Layer: Workspace settings
  local workspace_workflow
  workspace_workflow=$(load_haiku_setting "workflow" "")
  if [ -n "$workspace_workflow" ]; then
    workflow="$workspace_workflow"
  fi

  # Layer: Intent overrides (highest priority)
  if [ -n "$intent_dir" ] && [ -f "$intent_dir/intent.md" ]; then
    local intent_workflow
    intent_workflow=$(_yaml_get_simple "workflow" "" < "$intent_dir/intent.md")
    if [ -n "$intent_workflow" ]; then
      workflow="$intent_workflow"
    fi
  fi

  printf '{"workflow":"%s"}\n' "$workflow"
}

# Export config as environment variables
# Usage: export_haiku_config [intent_dir]
export_haiku_config() {
  local intent_dir="${1:-}"
  local config
  config=$(get_haiku_config "$intent_dir")

  export HAIKU_WORKFLOW
  if command -v jq &>/dev/null; then
    HAIKU_WORKFLOW=$(echo "$config" | jq -r '.workflow')
  else
    HAIKU_WORKFLOW=$(echo "$config" | sed -n 's/.*"workflow":"\([^"]*\)".*/\1/p')
  fi
}
